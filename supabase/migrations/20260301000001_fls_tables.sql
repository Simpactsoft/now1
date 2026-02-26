-- Migration: 20260301000001_fls_tables.sql
-- Description: Creates the Field-Level Security (FLS) access configuration tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.field_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL, -- Flexible to accommodate public.app_role or user_roles string
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT true,
    can_write BOOLEAN NOT NULL DEFAULT false,
    restricted_values JSONB, -- Optional array of allowed enum values
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(role, table_name, column_name)
);

-- Enable RLS
ALTER TABLE public.field_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users need to read these to know what fields they can see or edit
CREATE POLICY "authenticated_read_field_permissions"
    ON public.field_permissions FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only service role can manage field permissions
CREATE POLICY "service_role_manages_field_permissions"
    ON public.field_permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_field_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_field_permissions_updated_at ON public.field_permissions;
CREATE TRIGGER trg_field_permissions_updated_at
BEFORE UPDATE ON public.field_permissions
FOR EACH ROW
EXECUTE FUNCTION update_field_permissions_updated_at();

-- Note: We can add seeded FLS permissions here for demonstration later.

COMMIT;
