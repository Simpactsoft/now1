-- ==============================================================================
-- FIX: Revert Activity Stream Trigger to Support V1 Schema (`activities` + `activity_links`)
-- ==============================================================================

-- 1. Drop the failing trigger from the activities table
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;

-- 2. Update the handler function to read from `activity_links` linking table instead
CREATE OR REPLACE FUNCTION public.handle_activity_stream()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_record RECORD;
  
  -- Variables for V1 activity_links joining
  v_activity RECORD;
  v_entity_id UUID;
  v_entity_type TEXT;
BEGIN
  -- Determine whether to use OLD or NEW based on the operation
  v_record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- ==========================================
  -- QUOTES TABLE (unchanged)
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
  -- ACTIVITY_LINKS TABLE (V1 schema support)
  -- ==========================================
  ELSIF TG_TABLE_NAME = 'activity_links' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'activity_created'
      WHEN TG_OP = 'UPDATE' THEN 'activity_updated'
      ELSE 'activity_deleted' END;
      
    -- For V1 schema, the activity details are in public.activities 
    SELECT * INTO v_activity FROM public.activities WHERE id = v_record.activity_id;
    
    IF NOT FOUND THEN
      RETURN v_record;
    END IF;

    -- Map V1 columns (subject -> title, activity_type -> type)
    v_payload := jsonb_build_object(
      'title', v_activity.subject,
      'type', v_activity.activity_type,
      'priority', COALESCE(v_activity.priority, 'normal')
    );
    
    -- Extract entity_id and entity_type from the V1 activity_links table
    IF v_record.card_id IS NOT NULL THEN
       v_entity_id := v_record.card_id;
       v_entity_type := 'card';
    ELSIF v_record.opportunity_id IS NOT NULL THEN
       v_entity_id := v_record.opportunity_id;
       v_entity_type := 'opportunity';
    ELSIF v_record.lead_id IS NOT NULL THEN
       v_entity_id := v_record.lead_id;
       v_entity_type := 'lead';
    ELSE
       RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_entity_id,
      v_entity_type,
      v_event_type,
      COALESCE(v_activity.created_at, NOW()),
      COALESCE(auth.uid(), v_activity.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_activity.id,
      'activities'
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

-- 3. Attach the trigger to activity_links instead of activities
DROP TRIGGER IF EXISTS trg_link_to_stream ON public.activity_links;
CREATE TRIGGER trg_link_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();
