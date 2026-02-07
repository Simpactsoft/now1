-- ====================================================
-- DIAGNOSTIC CHECK: VERIFY MIGRATION STATE
-- ====================================================

DO $$
DECLARE
    v_func_exists BOOLEAN;
    v_table_exists BOOLEAN;
BEGIN
    RAISE NOTICE '--- Starting Diagnostics ---';

    -- 1. Check Table
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_categories')
    INTO v_table_exists;

    IF v_table_exists THEN
        RAISE NOTICE '✅ Table "product_categories" found.';
    ELSE
        RAISE WARNING '❌ Table "product_categories" NOT found. (Run Migration 007)';
    END IF;

    -- 2. Check Function Signature
    -- Looking for record_inventory_transaction(uuid, numeric, text, uuid, text)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'record_inventory_transaction'
    ) INTO v_func_exists;

    IF v_func_exists THEN
        RAISE NOTICE '✅ Function "record_inventory_transaction" found.';
    ELSE
        RAISE WARNING '❌ Function "record_inventory_transaction" NOT found. (Run Migration 008)';
    END IF;

    RAISE NOTICE '--- Diagnostics Complete ---';
END $$;
