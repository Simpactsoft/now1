-- ============================================================================
-- VERIFICATION SCRIPT: Test CPQ Migration
-- Run this after migration to verify everything is working
-- ============================================================================

-- 1. Verify all tables exist
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT ARRAY_AGG(table_name)
    INTO missing_tables
    FROM (VALUES 
        ('product_templates'),
        ('option_groups'),
        ('options'),
        ('option_overrides'),
        ('configuration_rules'),
        ('configurations'),
        ('configured_products'),
        ('template_presets')
    ) AS expected(table_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = expected.table_name
    );
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE 'MISSING TABLES: %', missing_tables;
    ELSE
        RAISE NOTICE '✅ All CPQ tables exist';
    END IF;
END $$;

-- 2. Verify functions exist
DO $$
BEGIN
    -- Check get_group_options function
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_group_options'
    ) THEN
        RAISE NOTICE '✅ Function get_group_options exists';
    ELSE
        RAISE NOTICE '❌ Function get_group_options missing';
    END IF;
    
    -- Check calculate_configuration_price function
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_configuration_price'
    ) THEN
        RAISE NOTICE '✅ Function calculate_configuration_price exists';
    ELSE
        RAISE NOTICE '❌ Function calculate_configuration_price missing';
    END IF;
    
    -- Check generate_share_token function
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'generate_share_token'
    ) THEN
        RAISE NOTICE '✅ Function generate_share_token exists';
    ELSE
        RAISE NOTICE '❌ Function generate_share_token missing';
    END IF;
END $$;

-- 3. Count records
SELECT 'product_templates' AS table_name, COUNT(*) AS record_count FROM product_templates
UNION ALL
SELECT 'option_groups', COUNT(*) FROM option_groups
UNION ALL
SELECT 'options', COUNT(*) FROM options
UNION ALL
SELECT 'configuration_rules', COUNT(*) FROM configuration_rules
UNION ALL
SELECT 'template_presets', COUNT(*) FROM template_presets
UNION ALL
SELECT 'configurations', COUNT(*) FROM configurations
UNION ALL
SELECT 'configured_products', COUNT(*) FROM configured_products;

-- 4. Test get_group_options function (if sample data exists)
DO $$
DECLARE
    test_template_id UUID;
    test_group_id UUID;
    options_count INT;
BEGIN
    -- Try to get first template
    SELECT id INTO test_template_id FROM product_templates LIMIT 1;
    
    IF test_template_id IS NOT NULL THEN
        -- Get first option group
        SELECT id INTO test_group_id FROM option_groups WHERE template_id = test_template_id LIMIT 1;
        
        IF test_group_id IS NOT NULL THEN
            -- Test get_group_options
            SELECT COUNT(*) INTO options_count
            FROM get_group_options(
                test_group_id,
                (SELECT tenant_id FROM product_templates WHERE id = test_template_id)
            );
            
            RAISE NOTICE '✅ Function get_group_options working - returned % options', options_count;
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  No sample data found (expected for fresh install)';
    END IF;
END $$;

-- 5. Summary
SELECT 
    'CPQ Migration Verification' AS status,
    CASE 
        WHEN COUNT(*) = 8 THEN '✅ COMPLETE'
        ELSE '❌ INCOMPLETE - ' || (8 - COUNT(*)) || ' tables missing'
    END AS result
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'product_templates',
    'option_groups',
    'options',
    'option_overrides',
    'configuration_rules',
    'configurations',
    'configured_products',
    'template_presets'
);
