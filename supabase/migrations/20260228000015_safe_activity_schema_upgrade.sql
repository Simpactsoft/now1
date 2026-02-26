-- =============================================================================
-- SAFE ACTIVITY ENGINE v2.1 SCHEMA UPGRADE
-- Converts the existing V1 activities schema to V2 without dropping data.
-- =============================================================================

BEGIN;

-- 1. ADD NEW COLUMNS TO ACTIVITIES (V2 SCHEMA)
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS type activity_type,
  ADD COLUMN IF NOT EXISTS title VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS parent_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;

-- 2. MIGRATE DATA FROM OLD COLUMNS TO NEW COLUMNS
UPDATE public.activities
SET 
  type = COALESCE(activity_type, 'task'::activity_type),
  title = COALESCE(subject, 'Untitled Activity'),
  description = body,
  due_date = due_at::DATE
WHERE type IS NULL OR title IS NULL;

-- 3. MIGRATE ENTITY LINKS FROM ACTIVITY_LINKS TO ACTIVITIES
UPDATE public.activities a
SET 
  entity_type = CASE 
    WHEN al.card_id IS NOT NULL THEN 'card'
    WHEN al.opportunity_id IS NOT NULL THEN 'opportunity'
    WHEN al.lead_id IS NOT NULL THEN 'lead'
    ELSE NULL
  END,
  entity_id = COALESCE(al.card_id, al.opportunity_id, al.lead_id)
FROM public.activity_links al
WHERE a.id = al.activity_id AND a.entity_id IS NULL;

-- 4. MAKE NEW COLUMNS REQUIRED
ALTER TABLE public.activities 
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL;

-- 5. DROP OLD V1 COLUMNS
ALTER TABLE public.activities 
  DROP COLUMN IF EXISTS activity_type,
  DROP COLUMN IF EXISTS subject,
  DROP COLUMN IF EXISTS body,
  DROP COLUMN IF EXISTS due_at,
  DROP COLUMN IF EXISTS is_task;

-- 6. REBUILD ACTIVITY_LINKS FOR ACTIVITY-TO-ACTIVITY THREADING
-- Since we migrated the old entity links into the `activities` table directly,
-- we clear the table and rebuild it strictly for activity-to-activity linking.

TRUNCATE TABLE public.activity_links;

ALTER TABLE public.activity_links
  DROP COLUMN IF EXISTS card_id,
  DROP COLUMN IF EXISTS opportunity_id,
  DROP COLUMN IF EXISTS lead_id,
  DROP COLUMN IF EXISTS campaign_id,
  DROP COLUMN IF EXISTS activity_id;

ALTER TABLE public.activity_links
  ADD COLUMN IF NOT EXISTS source_activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE;

-- Recreate constraints for the new structure
ALTER TABLE public.activity_links
  DROP CONSTRAINT IF EXISTS uq_activity_link,
  ADD CONSTRAINT uq_activity_link UNIQUE (source_activity_id, target_activity_id, link_type),
  ADD CONSTRAINT chk_no_self_link CHECK (source_activity_id != target_activity_id);

CREATE INDEX IF NOT EXISTS idx_links_source ON public.activity_links(source_activity_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON public.activity_links(target_activity_id);

-- 7. RECREATE THE V2 TRIGGER
-- Drop the V1 fix trigger from activity_links
DROP TRIGGER IF EXISTS trg_link_to_stream ON public.activity_links;

-- Recreate the correct trigger on activities
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;

CREATE OR REPLACE FUNCTION public.handle_activity_stream()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_record RECORD;
BEGIN
  v_record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- ==========================================
  -- QUOTES TABLE
  -- ==========================================
  IF TG_TABLE_NAME = 'quotes' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'quote_created'
      WHEN TG_OP = 'UPDATE' THEN 'quote_updated'
      ELSE 'quote_deleted' END;
      
    v_payload := jsonb_build_object(
      'quote_number', v_record.quote_number,
      'amount', v_record.grand_total,
      'status', v_record.status,
      'currency', v_record.currency
    );
    
    IF v_record.customer_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.customer_id,
      'customer',
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  -- ==========================================
  -- ACTIVITIES TABLE 
  -- ==========================================
  ELSIF TG_TABLE_NAME = 'activities' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'activity_created'
      WHEN TG_OP = 'UPDATE' THEN 'activity_updated'
      ELSE 'activity_deleted' END;
      
    v_payload := jsonb_build_object(
      'title', v_record.title,
      'type', v_record.type,
      'priority', COALESCE(v_record.priority, 'normal')
    );
    
    -- Only sync if linked to an entity
    IF v_record.entity_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.entity_id,
      COALESCE(v_record.entity_type, 'unknown'),
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  END IF;

  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_activity_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();

COMMIT;
