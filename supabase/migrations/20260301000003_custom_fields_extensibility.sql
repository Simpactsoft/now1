-- Migration: 20260301000003_custom_fields_extensibility.sql
-- Description: Creates the Custom Field Definitions dictionary and adds custom_fields JSONB columns to core tables with GIN indexes.

BEGIN;

-- 1. Create the Custom Field Definitions Table
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    field_name TEXT NOT NULL, -- e.g., 'erp_customer_id'
    display_name TEXT NOT NULL, -- e.g., 'ERP Customer ID'
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'single_select', 'multi_select')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    options JSONB, -- Array of strings for select types
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, table_name, field_name)
);

-- Enable RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "authenticated_read_custom_fields"
    ON public.custom_field_definitions FOR SELECT
    TO authenticated
    USING (true); -- Ideally scoped to tenant_id in the future

CREATE POLICY "service_role_manages_custom_fields"
    ON public.custom_field_definitions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_custom_field_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cfd_updated_at ON public.custom_field_definitions;
CREATE TRIGGER trg_cfd_updated_at
BEFORE UPDATE ON public.custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION update_custom_field_definitions_updated_at();


-- 2. Add custom_fields JSONB column to Core Tables
-- By using ADD COLUMN IF NOT EXISTS, we safely ensure it exists everywhere.

-- Organizations
ALTER TABLE IF EXISTS public.organizations ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_organizations_custom_fields ON public.organizations USING GIN (custom_fields jsonb_path_ops);

-- Cards (Contacts/People)
ALTER TABLE IF EXISTS public.cards ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_cards_custom_fields ON public.cards USING GIN (custom_fields jsonb_path_ops);

-- Quotes
ALTER TABLE IF EXISTS public.quotes ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_quotes_custom_fields ON public.quotes USING GIN (custom_fields jsonb_path_ops);

-- Products (Templates)
ALTER TABLE IF EXISTS public.cpq_product_templates ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_product_templates_custom_fields ON public.cpq_product_templates USING GIN (custom_fields jsonb_path_ops);

-- Invoices
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_invoices_custom_fields ON public.invoices USING GIN (custom_fields jsonb_path_ops);


COMMIT;
