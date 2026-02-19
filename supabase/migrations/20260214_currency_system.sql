-- ============================================================================
-- Currency System
-- Migration: 20260214_currency_system
-- Date: 2026-02-14
-- Description: Creates currencies reference table (global, no RLS) and
--              exchange_rates table (tenant-scoped with RLS).
--              Includes convert_currency() RPC with inverse rate fallback.
-- Dependencies: tenants.base_currency from migration 20260213
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CURRENCIES (Global Reference Table — NO RLS)
-- ============================================================================
-- Purpose: ISO 4217 currency definitions. Shared across all tenants.
-- No tenant_id — this is reference data, not tenant-specific.

CREATE TABLE IF NOT EXISTS currencies (
    code CHAR(3) PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE currencies IS 'ISO 4217 currency reference (global, no RLS)';

-- Seed common currencies
INSERT INTO currencies (code, name, symbol, decimal_places) VALUES
    ('USD', 'US Dollar',            '$',   2),
    ('EUR', 'Euro',                 '€',   2),
    ('ILS', 'Israeli New Shekel',   '₪',   2),
    ('GBP', 'British Pound',        '£',   2),
    ('JPY', 'Japanese Yen',         '¥',   0),
    ('CAD', 'Canadian Dollar',      'C$',  2),
    ('AUD', 'Australian Dollar',    'A$',  2),
    ('CHF', 'Swiss Franc',          'CHF', 2),
    ('SGD', 'Singapore Dollar',     'S$',  2),
    ('AED', 'UAE Dirham',           'د.إ', 2),
    ('BRL', 'Brazilian Real',       'R$',  2),
    ('MXN', 'Mexican Peso',        'Mex$', 2)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. EXCHANGE RATES (Tenant-Scoped)
-- ============================================================================
-- Purpose: Stores exchange rates per tenant.
-- Each rate is from_currency → to_currency with a timestamp.
-- The convert_currency() RPC picks the most recent rate.

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_currency CHAR(3) NOT NULL REFERENCES currencies(code),
    to_currency CHAR(3) NOT NULL REFERENCES currencies(code),
    rate NUMERIC(18, 8) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'manual',  -- 'manual', 'api', 'bank_of_israel', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cannot convert a currency to itself
    CONSTRAINT chk_not_same CHECK (from_currency <> to_currency),

    -- Rate must be positive
    CONSTRAINT chk_positive_rate CHECK (rate > 0)
);

COMMENT ON TABLE exchange_rates IS 'Exchange rates per tenant, most recent valid_from wins';
COMMENT ON COLUMN exchange_rates.source IS 'How the rate was obtained: manual, api, bank_of_israel, etc.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
-- RULE-02 compliant: tenant_id first

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
    ON exchange_rates(tenant_id, from_currency, to_currency, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_tenant
    ON exchange_rates(tenant_id, created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
-- currencies: NO RLS (global reference). It has no tenant_id.
-- exchange_rates: RLS with IS NOT NULL guard.

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_rates_select ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_insert ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_update ON exchange_rates;
DROP POLICY IF EXISTS exchange_rates_delete ON exchange_rates;

CREATE POLICY exchange_rates_select ON exchange_rates
    FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY exchange_rates_insert ON exchange_rates
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY exchange_rates_update ON exchange_rates
    FOR UPDATE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

CREATE POLICY exchange_rates_delete ON exchange_rates
    FOR DELETE TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 5. convert_currency() RPC
-- ============================================================================
-- Converts an amount from one currency to another using the most recent rate.
-- Logic:
--   1. Same currency → return amount unchanged
--   2. Try direct rate (from → to)
--   3. Try inverse rate (to → from) and use 1/rate
--   4. If no rate found → RAISE EXCEPTION with clear message
--
-- p_timestamp: optional — use rate valid at this point in time (for locking)

CREATE OR REPLACE FUNCTION convert_currency(
    p_amount NUMERIC,
    p_from_currency CHAR(3),
    p_to_currency CHAR(3),
    p_tenant_id UUID,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_rate NUMERIC;
    v_result NUMERIC;
BEGIN
    -- Same currency: return unchanged
    IF p_from_currency = p_to_currency THEN
        RETURN p_amount;
    END IF;

    -- Try direct rate: from → to
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE tenant_id = p_tenant_id
      AND from_currency = p_from_currency
      AND to_currency = p_to_currency
      AND valid_from <= p_timestamp
    ORDER BY valid_from DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
        v_result := ROUND(p_amount * v_rate, 2);
        RETURN v_result;
    END IF;

    -- Try inverse rate: to → from, use 1/rate
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE tenant_id = p_tenant_id
      AND from_currency = p_to_currency
      AND to_currency = p_from_currency
      AND valid_from <= p_timestamp
    ORDER BY valid_from DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
        v_result := ROUND(p_amount / v_rate, 2);
        RETURN v_result;
    END IF;

    -- No rate found — raise a clear exception
    RAISE EXCEPTION 'No exchange rate found for % → % (tenant: %, at: %)',
        p_from_currency, p_to_currency, p_tenant_id, p_timestamp;
END;
$$;

COMMENT ON FUNCTION convert_currency IS 'Convert amount between currencies using most recent rate. Tries direct then inverse. Raises exception if no rate found.';

COMMIT;
