-- ============================================================================
-- CPQ: Configuration Templates & Cloning Support
-- Migration: 20260214000002_add_configuration_templates
-- Date: 2026-02-14
-- Description: Adds template and cloning capabilities to the configurations table
-- ============================================================================

BEGIN;

-- Add template support columns to configurations table
ALTER TABLE configurations
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS source_configuration_id UUID REFERENCES configurations(id) ON DELETE SET NULL;

-- Add comments for new fields
COMMENT ON COLUMN configurations.is_template IS 
  'Flag indicating if this configuration is saved as a reusable template. Templates can be loaded by users to start new configurations.';

COMMENT ON COLUMN configurations.template_name IS 
  'Human-readable name for templates (e.g., "Standard Gaming PC", "Budget Office Setup"). Only set when is_template=true.';

COMMENT ON COLUMN configurations.source_configuration_id IS 
  'Reference to the original configuration when this was cloned. Used for tracking configuration lineage and analytics.';

-- Create index for efficient template lookups
CREATE INDEX IF NOT EXISTS idx_configurations_templates 
  ON configurations(tenant_id, is_template) 
  WHERE is_template = true;

-- Create unique constraint on template names within a tenant
-- This prevents duplicate template names but allows multiple non-templates with the same name
CREATE UNIQUE INDEX IF NOT EXISTS uq_configurations_template_name 
  ON configurations(tenant_id, template_name) 
  WHERE is_template = true AND template_name IS NOT NULL;

-- Create index for tracking cloned configurations
CREATE INDEX IF NOT EXISTS idx_configurations_source 
  ON configurations(source_configuration_id) 
  WHERE source_configuration_id IS NOT NULL;

-- Add validation constraint: templates must have a name
ALTER TABLE configurations
  ADD CONSTRAINT chk_template_has_name CHECK (
    is_template = false OR (is_template = true AND template_name IS NOT NULL)
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify everything is correct:
-- 
-- 1. Check new columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'configurations' 
-- AND column_name IN ('is_template', 'template_name', 'source_configuration_id');
--
-- 2. Check indexes were created:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'configurations' 
-- AND indexname LIKE '%template%';
--
-- 3. Verify constraint:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'configurations'::regclass 
-- AND conname = 'chk_template_has_name';
