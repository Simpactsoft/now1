-- --------------------------------------------------------------------------------
-- Unified Activity Stream Triggers
-- --------------------------------------------------------------------------------

-- Create the generic trigger function
CREATE OR REPLACE FUNCTION public.handle_activity_stream()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_record RECORD;
BEGIN
  -- Determine whether to use OLD or NEW based on the operation
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
    
    -- If no customer, we can't tie it to an entity timeline
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
      'priority', v_record.priority
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


-- ==========================================
-- Triggers for Quotes
-- ==========================================
DROP TRIGGER IF EXISTS trg_quote_to_stream ON public.quotes;
CREATE TRIGGER trg_quote_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();

-- ==========================================
-- Triggers for Activities 
-- ==========================================
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;
CREATE TRIGGER trg_activity_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();
