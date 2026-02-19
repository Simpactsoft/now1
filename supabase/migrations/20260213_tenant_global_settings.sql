-- ============================================================================
-- Tenant Global Settings
-- Migration: 20260213_tenant_global_settings
-- Date: 2026-02-13
-- Description: Adds global configuration columns to the tenants table
--              for multi-currency, localization, compliance, and feature flags.
-- Dependencies: tenants table (core schema)
-- ============================================================================

BEGIN;

-- Base currency for the tenant (all prices stored in this currency)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    base_currency CHAR(3) NOT NULL DEFAULT 'USD';

-- Default locale for formatting (dates, numbers, etc.)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    default_locale TEXT NOT NULL DEFAULT 'en-US';

-- Timezone for date display and scheduling
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    timezone TEXT NOT NULL DEFAULT 'UTC';

-- Right-to-Left layout (Hebrew, Arabic)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    rtl_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Compliance plugins activated for this tenant
-- e.g., ARRAY['IL'] for Israeli tax/invoicing, ARRAY['IL','EU_VAT'] for both
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    compliance_plugins TEXT[] NOT NULL DEFAULT '{}';

-- Feature flags (flexible JSONB for per-tenant toggles)
-- e.g., {"prevent_negative_stock": true, "require_quote_approval": false}
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    feature_flags JSONB NOT NULL DEFAULT '{}';

-- Auto-generated document number prefixes
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    invoice_prefix TEXT NOT NULL DEFAULT 'INV';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    quote_prefix TEXT NOT NULL DEFAULT 'QT';

-- Minimum margin percentage for profitability guard (Phase 2)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
    min_margin_pct NUMERIC(5, 2) DEFAULT NULL;

COMMENT ON COLUMN tenants.base_currency IS 'ISO 4217 currency code — all prices stored in this currency';
COMMENT ON COLUMN tenants.compliance_plugins IS 'Array of country codes for activated compliance plugins, e.g. {IL,EU_VAT}';
COMMENT ON COLUMN tenants.feature_flags IS 'JSONB feature toggles per tenant';
COMMENT ON COLUMN tenants.min_margin_pct IS 'Minimum profit margin % — quotes below this are routed to approval (NULL = no check)';

COMMIT;
