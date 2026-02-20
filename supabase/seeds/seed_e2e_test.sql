-- ============================================================================
-- E2E Test Seed Data — Quote to Payment Flow
-- ============================================================================
-- USAGE: Run this script against your Supabase project to seed all data
--        needed for the Quote → Invoice → Payment E2E test.
-- SAFETY: Fully idempotent — uses ON CONFLICT DO NOTHING and IF NOT EXISTS.
-- CONSTRAINT: Does NOT modify application code or create new migrations.
-- ============================================================================

-- ============================================================================
-- SCHEMA PREREQUISITES — ensure columns/tables from pending migrations exist
-- ============================================================================

-- account_sub_type column (from 20260220_account_type_resolution migration)
ALTER TABLE chart_of_accounts
    ADD COLUMN IF NOT EXISTS account_sub_type TEXT;

CREATE INDEX IF NOT EXISTS idx_coa_sub_type
    ON chart_of_accounts(tenant_id, account_sub_type)
    WHERE account_sub_type IS NOT NULL;

-- ============================================================================
-- MAIN SEED BLOCK
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_zone_id UUID;
    v_class_id UUID;
BEGIN
    -- ========================================================================
    -- 1. RESOLVE TENANT from logged-in user's profile
    -- ========================================================================
    SELECT tenant_id INTO v_tenant_id FROM public.profiles LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found in profiles table. Please log in first.';
    END IF;

    RAISE NOTICE '✅ Tenant resolved: %', v_tenant_id;

    -- ========================================================================
    -- 2. PRODUCTS — 3 products with cost and list prices
    -- ========================================================================
    INSERT INTO products (tenant_id, sku, name, description, cost_price, list_price, track_inventory)
    VALUES
        (v_tenant_id, 'WGT-A', 'Widget A', 'Standard widget for testing', 100.00, 150.00, true),
        (v_tenant_id, 'WGT-B', 'Widget B', 'Premium widget for testing', 200.00, 300.00, true),
        (v_tenant_id, 'GDG-PRO', 'Gadget Pro', 'Professional gadget for testing', 500.00, 750.00, true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Products seeded (3 items)';

    -- ========================================================================
    -- 3. TAX ZONE + CLASS + RATE — Israeli 17% VAT
    -- ========================================================================

    -- Tax Zone: Israel Domestic
    INSERT INTO tax_zones (tenant_id, name, country_codes, is_default, metadata)
    VALUES (
        v_tenant_id,
        'Israel Domestic',
        ARRAY['IL'],
        true,
        '{"region": "Israel", "description": "Standard Israeli tax zone"}'::jsonb
    )
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_zone_id FROM tax_zones
    WHERE tenant_id = v_tenant_id AND name = 'Israel Domestic' LIMIT 1;

    RAISE NOTICE '✅ Tax zone: Israel Domestic (id: %)', v_zone_id;

    -- Tax Class: Standard Goods
    INSERT INTO tax_classes (tenant_id, name, description, is_default)
    VALUES (
        v_tenant_id,
        'Standard Goods',
        'Standard goods and services subject to VAT',
        true
    )
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_class_id FROM tax_classes
    WHERE tenant_id = v_tenant_id AND name = 'Standard Goods' LIMIT 1;

    RAISE NOTICE '✅ Tax class: Standard Goods (id: %)', v_class_id;

    -- Tax Rate: 17% VAT
    IF v_zone_id IS NOT NULL AND v_class_id IS NOT NULL THEN
        INSERT INTO tax_rates (tenant_id, zone_id, tax_class_id, name, rate, is_compound, valid_from)
        VALUES (
            v_tenant_id,
            v_zone_id,
            v_class_id,
            'מע"מ 17%',
            0.170000,
            false,
            '2024-01-01'
        )
        ON CONFLICT DO NOTHING;
        RAISE NOTICE '✅ Tax rate: 17%% VAT seeded';
    END IF;

    -- ========================================================================
    -- 4. CHART OF ACCOUNTS — Israeli accounts with account_sub_type
    -- ========================================================================
    -- Seeded inline (not via seed_il_chart_of_accounts function) because
    -- the DB function may not include account_sub_type yet.

    -- Assets (1xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (v_tenant_id, '1000', 'נכסים', 'asset', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '1100', 'קופה ומזומנים', 'asset', 'cash', 'debit', true, 'ILS'),
        (v_tenant_id, '1200', 'בנק - חשבון עו"ש', 'asset', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '1300', 'חייבים ולקוחות', 'asset', 'accounts_receivable', 'debit', true, 'ILS'),
        (v_tenant_id, '1400', 'מלאי', 'asset', 'inventory', 'debit', true, 'ILS'),
        (v_tenant_id, '1500', 'ציוד ורכוש קבוע', 'asset', NULL, 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    -- Liabilities (2xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (v_tenant_id, '2000', 'התחייבויות', 'liability', NULL, 'credit', true, 'ILS'),
        (v_tenant_id, '2100', 'ספקים וזכאים', 'liability', 'accounts_payable', 'credit', true, 'ILS'),
        (v_tenant_id, '2200', 'מע"מ לשלם', 'liability', 'tax_liability', 'credit', true, 'ILS'),
        (v_tenant_id, '2300', 'מס הכנסה לשלם', 'liability', NULL, 'credit', true, 'ILS'),
        (v_tenant_id, '2400', 'הלוואות', 'liability', NULL, 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    -- Equity (3xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, normal_balance, is_system, currency)
    VALUES
        (v_tenant_id, '3000', 'הון עצמי', 'equity', 'credit', true, 'ILS'),
        (v_tenant_id, '3100', 'הון מניות', 'equity', 'credit', true, 'ILS'),
        (v_tenant_id, '3200', 'עודפים', 'equity', 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO NOTHING;

    -- Revenue (4xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (v_tenant_id, '4000', 'הכנסות', 'revenue', NULL, 'credit', true, 'ILS'),
        (v_tenant_id, '4100', 'הכנסות ממכירות', 'revenue', 'revenue', 'credit', true, 'ILS'),
        (v_tenant_id, '4200', 'הכנסות משירותים', 'revenue', NULL, 'credit', true, 'ILS'),
        (v_tenant_id, '4300', 'הכנסות אחרות', 'revenue', NULL, 'credit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    -- Expenses (5xxx-6xxx)
    INSERT INTO chart_of_accounts (tenant_id, account_number, name, account_type, account_sub_type, normal_balance, is_system, currency)
    VALUES
        (v_tenant_id, '5000', 'עלות המכר', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '5100', 'רכש חומרים', 'expense', 'cogs', 'debit', true, 'ILS'),
        (v_tenant_id, '5200', 'עלויות ייצור', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6000', 'הוצאות תפעול', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6100', 'שכר עבודה', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6200', 'שכירות', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6300', 'ביטוח', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6400', 'פחת', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6500', 'הוצאות משרדיות', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6600', 'הוצאות שיווק ופרסום', 'expense', NULL, 'debit', true, 'ILS'),
        (v_tenant_id, '6700', 'הוצאות מימון', 'expense', NULL, 'debit', true, 'ILS')
    ON CONFLICT (tenant_id, account_number) DO UPDATE
        SET account_sub_type = EXCLUDED.account_sub_type
        WHERE chart_of_accounts.account_sub_type IS NULL;

    RAISE NOTICE '✅ Chart of accounts: Israeli accounts seeded with account_sub_type';

    -- Verify required sub_types
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND account_sub_type = 'cash') THEN
        RAISE WARNING '⚠️  Missing account_sub_type: cash';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND account_sub_type = 'accounts_receivable') THEN
        RAISE WARNING '⚠️  Missing account_sub_type: accounts_receivable';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND account_sub_type = 'revenue') THEN
        RAISE WARNING '⚠️  Missing account_sub_type: revenue';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND account_sub_type = 'tax_liability') THEN
        RAISE WARNING '⚠️  Missing account_sub_type: tax_liability';
    END IF;

    -- ========================================================================
    -- 5. WAREHOUSE — default warehouse
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE tenant_id = v_tenant_id) THEN
        INSERT INTO warehouses (tenant_id, code, name, address, is_default)
        VALUES (v_tenant_id, 'MAIN', 'Main Warehouse', 'Tel Aviv, Israel', true);
        RAISE NOTICE '✅ Warehouse: Main Warehouse created';
    ELSE
        RAISE NOTICE '✅ Warehouse: already exists';
    END IF;

    -- ========================================================================
    -- 6. DOCUMENT NUMBER SEQUENCES — ensure INV/PO/PAY exist
    -- ========================================================================
    INSERT INTO document_number_sequences (tenant_id, document_type, prefix, year, last_number)
    VALUES
        (v_tenant_id, 'invoice', 'INV', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0),
        (v_tenant_id, 'po', 'PO', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0),
        (v_tenant_id, 'payment', 'PAY', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 0)
    ON CONFLICT (tenant_id, document_type, prefix, year) DO NOTHING;

    RAISE NOTICE '✅ Document sequences: INV/PO/PAY seeded';

    -- ========================================================================
    -- 7. VERIFY — summary of what's available
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'E2E SEED DATA SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tenant:     %', v_tenant_id;
    RAISE NOTICE 'Products:   %',
        (SELECT COUNT(*) FROM products WHERE tenant_id = v_tenant_id);
    RAISE NOTICE 'Customers:  % (cards)',
        (SELECT COUNT(*) FROM cards WHERE tenant_id = v_tenant_id);
    RAISE NOTICE 'Accounts:   %',
        (SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id = v_tenant_id);
    RAISE NOTICE 'Warehouses: %',
        (SELECT COUNT(*) FROM warehouses WHERE tenant_id = v_tenant_id);
    RAISE NOTICE 'Tax zones:  %',
        (SELECT COUNT(*) FROM tax_zones WHERE tenant_id = v_tenant_id);
    RAISE NOTICE '========================================';

END $$;
