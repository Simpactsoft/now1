-- ============================================================================
-- Global Tax Engine
-- Migration: 20260215_tax_engine
-- Date: 2026-02-15
-- Description: Creates the global tax engine tables: tax_zones, tax_classes,
--              tax_rates, and tax_exemptions. Supports compound taxes,
--              date-bounded rates, and compliance plugin integration.
-- Dependencies: tenants, cards (for customer_id)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TAX ZONES (Geographic Tax Jurisdictions)
-- ============================================================================
-- Purpose: Defines geographic regions that share the same tax rules.
-- Examples: "Israel Domestic", "Eilat Free Trade", "EU", "US-CA-Los Angeles"

CREATE TABLE IF NOT EXISTS tax_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    country_codes CHAR(2)[] NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE tax_zones IS 'Geographic tax jurisdictions (e.g., Israel Domestic, Eilat Free Trade)';
COMMENT ON COLUMN tax_zones.country_codes IS 'ISO 3166-1 alpha-2 codes this zone applies to';
COMMENT ON COLUMN tax_zones.is_default IS 'Default zone for new customers in this tenant';

-- ============================================================================
-- 2. TAX CLASSES (Product Tax Categories)
-- ============================================================================
-- Purpose: Categorizes products/services by how they are taxed.
-- Examples: "Standard", "Reduced", "Zero-rated", "Exempt", "Digital Services"

CREATE TABLE IF NOT EXISTS tax_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE tax_classes IS 'Product tax categories (Standard, Reduced, Zero-rated, Exempt)';

-- ============================================================================
-- 3. TAX RATES (Actual Rate Definitions)
-- ============================================================================
-- Purpose: Links a zone + class to a specific rate, with date validity.
-- Supports compound taxes (e.g., GST + PST in Canada).
-- compliance_plugin is NULL for global core rates, set for plugin-managed rates.

CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    zone_id UUID NOT NULL REFERENCES tax_zones(id) ON DELETE CASCADE,
    tax_class_id UUID NOT NULL REFERENCES tax_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate NUMERIC(10, 6) NOT NULL,  -- e.g., 0.170000 for 17%
    is_compound BOOLEAN NOT NULL DEFAULT false,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE DEFAULT NULL,  -- NULL = currently active

    -- Plugin integration: NULL for standard rates, set for compliance-managed
    compliance_plugin TEXT DEFAULT NULL,
    plugin_metadata JSONB DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tax_rates IS 'Tax rate definitions with date validity and optional compliance plugin link';
COMMENT ON COLUMN tax_rates.rate IS 'Decimal rate, e.g., 0.17 for 17%';
COMMENT ON COLUMN tax_rates.is_compound IS 'If true, this rate compounds on top of previous rates';
COMMENT ON COLUMN tax_rates.valid_to IS 'NULL means currently active (no end date)';
COMMENT ON COLUMN tax_rates.compliance_plugin IS 'NULL for global rates, country code for plugin-managed rates';

-- ============================================================================
-- 4. TAX EXEMPTIONS (Customer-Specific)
-- ============================================================================
-- Purpose: Records tax exemptions for specific customers in specific zones.
-- Example: Non-profit org exempt from VAT in Israel.

CREATE TABLE IF NOT EXISTS tax_exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    tax_zone_id UUID NOT NULL REFERENCES tax_zones(id) ON DELETE CASCADE,
    exemption_number TEXT,
    reason TEXT,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE DEFAULT NULL,  -- NULL = no expiry
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tax_exemptions IS 'Customer-specific tax exemptions by zone';
COMMENT ON COLUMN tax_exemptions.document_url IS 'URL to uploaded exemption certificate';

-- ============================================================================
-- 5. INDEXES (RULE-02: tenant_id first)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tax_zones_tenant
    ON tax_zones(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tax_zones_tenant_default
    ON tax_zones(tenant_id, is_default)
    WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_tax_classes_tenant
    ON tax_classes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tax_rates_lookup
    ON tax_rates(tenant_id, zone_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_tax_rates_class
    ON tax_rates(tenant_id, tax_class_id);

CREATE INDEX IF NOT EXISTS idx_tax_rates_active
    ON tax_rates(tenant_id, zone_id, tax_class_id)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_tax_exemptions_customer
    ON tax_exemptions(tenant_id, customer_id, tax_zone_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RULE-01: IS NOT NULL guard)
-- ============================================================================

ALTER TABLE tax_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_exemptions ENABLE ROW LEVEL SECURITY;

-- Tax Zones
DROP POLICY IF EXISTS tax_zones_select ON tax_zones;
DROP POLICY IF EXISTS tax_zones_all ON tax_zones;

CREATE POLICY tax_zones_select ON tax_zones
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY tax_zones_all ON tax_zones
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- Tax Classes
DROP POLICY IF EXISTS tax_classes_select ON tax_classes;
DROP POLICY IF EXISTS tax_classes_all ON tax_classes;

CREATE POLICY tax_classes_select ON tax_classes
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY tax_classes_all ON tax_classes
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- Tax Rates
DROP POLICY IF EXISTS tax_rates_select ON tax_rates;
DROP POLICY IF EXISTS tax_rates_all ON tax_rates;

CREATE POLICY tax_rates_select ON tax_rates
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY tax_rates_all ON tax_rates
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- Tax Exemptions
DROP POLICY IF EXISTS tax_exemptions_select ON tax_exemptions;
DROP POLICY IF EXISTS tax_exemptions_all ON tax_exemptions;

CREATE POLICY tax_exemptions_select ON tax_exemptions
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY tax_exemptions_all ON tax_exemptions
    FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 7. calculate_tax() RPC
-- ============================================================================
-- Returns matching tax rates for a given (tenant, zone, class, customer, date).
-- Checks exemptions first — returns empty result set for exempt customers.

CREATE OR REPLACE FUNCTION calculate_tax(
    p_tenant_id UUID,
    p_zone_id UUID,
    p_tax_class_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    tax_rate_id UUID,
    tax_name TEXT,
    rate NUMERIC,
    is_compound BOOLEAN,
    tax_amount NUMERIC,
    compliance_plugin TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_is_exempt BOOLEAN := false;
    v_class_id UUID;
BEGIN
    -- 1. Check exemptions first
    IF p_customer_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM tax_exemptions te
            WHERE te.tenant_id = p_tenant_id
              AND te.customer_id = p_customer_id
              AND te.tax_zone_id = p_zone_id
              AND te.valid_from <= p_date
              AND (te.valid_to IS NULL OR te.valid_to >= p_date)
        ) INTO v_is_exempt;

        IF v_is_exempt THEN
            RETURN; -- Empty result set for exempt customers
        END IF;
    END IF;

    -- 2. If no tax class specified, use the default for this tenant
    IF p_tax_class_id IS NULL THEN
        SELECT id INTO v_class_id
        FROM tax_classes
        WHERE tenant_id = p_tenant_id
          AND is_default = true
        LIMIT 1;
    ELSE
        v_class_id := p_tax_class_id;
    END IF;

    -- 3. Return matching rates (valid at p_date)
    RETURN QUERY
    SELECT
        tr.id AS tax_rate_id,
        tr.name AS tax_name,
        tr.rate,
        tr.is_compound,
        CASE
            WHEN tr.is_compound THEN
                -- Compound: apply on top of previously taxed amount
                -- (Simplified: just multiply by rate for now; full compound needs iteration)
                ROUND(p_amount * tr.rate, 2)
            ELSE
                ROUND(p_amount * tr.rate, 2)
        END AS tax_amount,
        tr.compliance_plugin
    FROM tax_rates tr
    WHERE tr.tenant_id = p_tenant_id
      AND tr.zone_id = p_zone_id
      AND (v_class_id IS NULL OR tr.tax_class_id = v_class_id)
      AND tr.valid_from <= p_date
      AND (tr.valid_to IS NULL OR tr.valid_to >= p_date)
    ORDER BY tr.is_compound ASC, tr.name;
END;
$$;

COMMENT ON FUNCTION calculate_tax IS 'Returns matching tax rates for (tenant, zone, class, customer, date). Returns empty for exempt customers.';

-- ============================================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tax_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_zones_updated_at ON tax_zones;
CREATE TRIGGER trg_tax_zones_updated_at
    BEFORE UPDATE ON tax_zones
    FOR EACH ROW EXECUTE FUNCTION update_tax_updated_at();

DROP TRIGGER IF EXISTS trg_tax_classes_updated_at ON tax_classes;
CREATE TRIGGER trg_tax_classes_updated_at
    BEFORE UPDATE ON tax_classes
    FOR EACH ROW EXECUTE FUNCTION update_tax_updated_at();

DROP TRIGGER IF EXISTS trg_tax_rates_updated_at ON tax_rates;
CREATE TRIGGER trg_tax_rates_updated_at
    BEFORE UPDATE ON tax_rates
    FOR EACH ROW EXECUTE FUNCTION update_tax_updated_at();

DROP TRIGGER IF EXISTS trg_tax_exemptions_updated_at ON tax_exemptions;
CREATE TRIGGER trg_tax_exemptions_updated_at
    BEFORE UPDATE ON tax_exemptions
    FOR EACH ROW EXECUTE FUNCTION update_tax_updated_at();

COMMIT;
