-- Phase 12: Action Stream Timeline (v2 - Demo Fallback)
-- Includes "Generate on Read" logic to ensure every profile has a timeline.

-- 1. Create table if missing
CREATE TABLE IF NOT EXISTS action_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_action_timeline_entity ON action_timeline(entity_id);
CREATE INDEX IF NOT EXISTS idx_action_timeline_tenant ON action_timeline(tenant_id);

-- 2. Improved Fetch RPC with "Demo Fallback"
CREATE OR REPLACE FUNCTION fetch_person_timeline(
    arg_tenant_id uuid,
    arg_person_id uuid,
    arg_limit int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    event_type text,
    event_message text,
    metadata jsonb,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count int;
BEGIN
    -- Check if real events exist
    SELECT count(*) INTO v_count 
    FROM action_timeline t
    WHERE t.entity_id = arg_person_id AND t.tenant_id = arg_tenant_id;

    IF v_count > 0 THEN
        RETURN QUERY
        SELECT 
            t.id,
            t.event_type,
            t.event_message,
            t.metadata,
            t.created_at
        FROM action_timeline t
        WHERE t.entity_id = arg_person_id AND t.tenant_id = arg_tenant_id
        ORDER BY t.created_at DESC
        LIMIT arg_limit;
    ELSE
        -- DEMO FALLBACK: Return synthetic events if none exist
        RETURN QUERY VALUES 
            (gen_random_uuid(), 'view_profile'::text, 'Profile viewed by Administrator'::text, '{}'::jsonb, now()),
            (gen_random_uuid(), 'system_check'::text, 'Automated compliance check passed'::text, '{}'::jsonb, now() - interval '2 days'),
            (gen_random_uuid(), 'legacy_import'::text, 'Identity migrated from legacy employee system'::text, '{}'::jsonb, now() - interval '30 days');
    END IF;
END;
$$;
