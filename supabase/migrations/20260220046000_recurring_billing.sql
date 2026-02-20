-- Migration: 20260220046000_recurring_billing.sql
-- Description: Adds subscription fields to products, quote items, and quotes to support Automated Billing & Recurring revenues.

BEGIN;

-- 1. Add fields to products (default configuration for the item)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_frequency TEXT CHECK (billing_frequency IN ('monthly', 'quarterly', 'yearly'));

-- 2. Add fields to quote_items (specific configuration chosen for this quote line)
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_frequency TEXT CHECK (billing_frequency IN ('monthly', 'quarterly', 'yearly'));

-- 3. Add fields to quotes (separated totals for the UI / ERP syncing)
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS recurring_total_monthly NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recurring_total_yearly NUMERIC(15,2) DEFAULT 0;

COMMIT;
