-- Migration 50: Create Saved Views Table (Fixed)
-- Purpose: Store user-defined filter presets (Saved Filters).
-- Fix: Using tenant_members for RLS instead of public.users.

CREATE TABLE IF NOT EXISTS saved_views (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb, -- Stores { filterModel, sortModel, viewMode }
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraint: Unique name per tenant to avoid confusion
    CONSTRAINT uq_saved_views_name_tenant UNIQUE (tenant_id, name)
);

-- Enable RLS
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Tenant Isolation via tenant_members)
CREATE POLICY "Users can view saved views for their tenant"
    ON saved_views FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert saved views for their tenant"
    ON saved_views FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update saved views for their tenant"
    ON saved_views FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete saved views for their tenant"
    ON saved_views FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

-- Index for fast lookup by tenant
CREATE INDEX IF NOT EXISTS idx_saved_views_tenant ON saved_views(tenant_id);
