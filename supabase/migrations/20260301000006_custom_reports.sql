-- Migration: 20260301000006_custom_reports.sql
-- Description: Extends the existing saved_views table to support advanced reporting and visualizations.

BEGIN;

-- 1. Extend saved_views table
-- We are adding visualization_config and is_public to the existing table created in migration 50.
ALTER TABLE IF EXISTS public.saved_views 
    ADD COLUMN IF NOT EXISTS visualization_config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS entity_type TEXT; -- Adding this manually to ensure it exists for reporting

-- 2. Update existing views if any
UPDATE public.saved_views
SET entity_type = 'unknown' 
WHERE entity_type IS NULL;

-- 3. Enhance RLS Policies for Public Reports
-- Allow other users in the same tenant to read "is_public" reports, even if they didn't create them.
-- Note: Assuming the original policies only allowed creators/owners. We add a generic read policy.
DROP POLICY IF EXISTS "Users can view public saved views in their tenant" ON public.saved_views;

CREATE POLICY "Users can view public saved views in their tenant"
    ON public.saved_views FOR SELECT
    USING (
        is_public = true AND
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

-- 4. Create Materialized View helper function
-- While we don't create specific materialized views here to prevent blocking standard operations,
-- we provide a helper to refresh materialized views efficiently (often used in reporting dashboards).
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
