-- Add configurability support to products table
-- Phase 1: Product-CPQ Bridge
-- Safe migration: adds nullable columns with sensible defaults

-- Add is_configurable flag
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS is_configurable BOOLEAN DEFAULT false;

-- Add template_id reference (bidirectional link)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES product_templates(id) ON DELETE SET NULL;

-- Create index for filtering configurable products
CREATE INDEX IF NOT EXISTS idx_products_configurable 
  ON products(is_configurable) 
  WHERE is_configurable = true;

-- Backfill existing templates -> products link
-- This creates the bidirectional relationship for existing data
UPDATE products p
SET template_id = pt.id
FROM product_templates pt
WHERE pt.base_product_id = p.id
  AND p.template_id IS NULL;

-- Add helpful comment
COMMENT ON COLUMN products.is_configurable IS 
  'Flag indicating if this product requires CPQ configuration. If true, a template_id should be set.';

COMMENT ON COLUMN products.template_id IS 
  'Reference to the CPQ template used to configure this product. Bidirectional link with product_templates.base_product_id.';
