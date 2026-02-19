-- ============================================================================
-- Product Variants System
-- Migration: 20260221_product_variants
-- Date: 2026-02-19
-- Description: Adds parent/child product pattern for variants (sizes, colors,
--              materials). Parent products get has_variants flag, child variants
--              have their own SKU, pricing, and inventory.
-- Dependencies: products (007)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD has_variants FLAG TO PRODUCTS
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.has_variants IS 'True if this product is a parent with variants';

-- ============================================================================
-- 2. VARIANT ATTRIBUTES TABLE
-- ============================================================================
-- Defines what attributes a tenant uses for variants: Color, Size, Material, etc.

CREATE TABLE IF NOT EXISTS variant_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,                 -- "Color", "Size", "Material"
    display_name TEXT,                  -- Localized display name
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE variant_attributes IS 'Variant dimension definitions per tenant (e.g., Color, Size)';

-- ============================================================================
-- 3. VARIANT ATTRIBUTE VALUES TABLE
-- ============================================================================
-- Allowed values per attribute: Red, Blue, Green for Color; S, M, L for Size.

CREATE TABLE IF NOT EXISTS variant_attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    attribute_id UUID NOT NULL REFERENCES variant_attributes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,                -- "Red", "M", "Cotton"
    display_value TEXT,                 -- Localized display value
    color_hex TEXT,                     -- Optional: hex color for swatches (#FF0000)
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, attribute_id, value)
);

COMMENT ON TABLE variant_attribute_values IS 'Allowed values for each variant attribute';

-- ============================================================================
-- 4. PRODUCT VARIANTS TABLE
-- ============================================================================
-- Child products linked to a parent, with their own SKU, pricing, and attributes.

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT,                          -- Auto-generated or overridden: "T-Shirt - Red / M"
    attribute_values JSONB NOT NULL DEFAULT '{}',  -- {"color": "Red", "size": "M"}
    cost_price NUMERIC(15, 2) DEFAULT 0,
    list_price NUMERIC(15, 2) DEFAULT 0,
    weight NUMERIC(10, 3),
    barcode TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, parent_product_id, attribute_values)
);

COMMENT ON TABLE product_variants IS 'Child products with specific attribute combinations';
COMMENT ON COLUMN product_variants.attribute_values IS 'JSONB map of attribute_name → value, e.g. {"color":"Red","size":"M"}';

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_variant_attributes_tenant
    ON variant_attributes(tenant_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_variant_attribute_values_attr
    ON variant_attribute_values(tenant_id, attribute_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_variants_parent
    ON product_variants(tenant_id, parent_product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_sku
    ON product_variants(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_product_variants_attrs
    ON product_variants USING GIN (attribute_values);

CREATE INDEX IF NOT EXISTS idx_products_has_variants
    ON products(tenant_id, has_variants)
    WHERE has_variants = true;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- variant_attributes
DROP POLICY IF EXISTS variant_attributes_select ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_insert ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_update ON variant_attributes;
DROP POLICY IF EXISTS variant_attributes_delete ON variant_attributes;

CREATE POLICY variant_attributes_select ON variant_attributes FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_insert ON variant_attributes FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_update ON variant_attributes FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attributes_delete ON variant_attributes FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- variant_attribute_values
DROP POLICY IF EXISTS variant_attribute_values_select ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_insert ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_update ON variant_attribute_values;
DROP POLICY IF EXISTS variant_attribute_values_delete ON variant_attribute_values;

CREATE POLICY variant_attribute_values_select ON variant_attribute_values FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_insert ON variant_attribute_values FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_update ON variant_attribute_values FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY variant_attribute_values_delete ON variant_attribute_values FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- product_variants
DROP POLICY IF EXISTS product_variants_select ON product_variants;
DROP POLICY IF EXISTS product_variants_insert ON product_variants;
DROP POLICY IF EXISTS product_variants_update ON product_variants;
DROP POLICY IF EXISTS product_variants_delete ON product_variants;

CREATE POLICY product_variants_select ON product_variants FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_insert ON product_variants FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_update ON product_variants FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY product_variants_delete ON product_variants FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 7. get_product_variants() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_product_variants(
    p_product_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    variant_id UUID,
    sku TEXT,
    variant_name TEXT,
    attribute_values JSONB,
    cost_price NUMERIC,
    list_price NUMERIC,
    is_active BOOLEAN,
    barcode TEXT,
    sort_order INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Resolve tenant from product if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM products WHERE id = p_product_id;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;

    RETURN QUERY
    SELECT
        pv.id,
        pv.sku,
        pv.name,
        pv.attribute_values,
        pv.cost_price,
        pv.list_price,
        pv.is_active,
        pv.barcode,
        pv.sort_order
    FROM product_variants pv
    WHERE pv.parent_product_id = p_product_id
      AND pv.tenant_id = v_tenant_id
    ORDER BY pv.sort_order, pv.sku;
END;
$$;

-- ============================================================================
-- 8. Auto-generate variant name trigger
-- ============================================================================
-- When a variant is inserted/updated, auto-build name from parent + attributes.

CREATE OR REPLACE FUNCTION generate_variant_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_parent_name TEXT;
    v_attr_parts TEXT[];
    v_key TEXT;
    v_val TEXT;
BEGIN
    -- Only auto-generate if name is not explicitly set
    IF NEW.name IS NOT NULL AND NEW.name != '' THEN
        RETURN NEW;
    END IF;

    -- Get parent product name
    SELECT name INTO v_parent_name FROM products WHERE id = NEW.parent_product_id;

    -- Build attribute string from JSONB
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(NEW.attribute_values) ORDER BY 1
    LOOP
        v_attr_parts := array_append(v_attr_parts, v_val);
    END LOOP;

    NEW.name := v_parent_name || ' - ' || array_to_string(v_attr_parts, ' / ');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_variant_name ON product_variants;
CREATE TRIGGER trg_generate_variant_name
    BEFORE INSERT OR UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION generate_variant_name();

-- ============================================================================
-- 9. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_variant_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variant_attributes_updated_at ON variant_attributes;
CREATE TRIGGER trg_variant_attributes_updated_at
    BEFORE UPDATE ON variant_attributes
    FOR EACH ROW EXECUTE FUNCTION update_variant_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_variant_updated_at();

COMMIT;
