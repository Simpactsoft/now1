-- ============================================================================
-- STEP 1: Verify CPQ Tables Created
-- ============================================================================
-- Run this in Supabase SQL Editor to confirm all tables exist

SELECT 
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_schema='public' 
     AND table_name=t.table_name) AS column_count
FROM information_schema.tables t
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
)
ORDER BY table_name;

-- Expected: 8 rows (one for each table)


-- ============================================================================
-- STEP 2: Verify CPQ Functions Created
-- ============================================================================

SELECT 
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN (
    'get_group_options',
    'calculate_configuration_price',
    'generate_share_token'
)
ORDER BY proname;

-- Expected: 3 rows (one for each function)


-- ============================================================================
-- STEP 3: Verify RLS Policies Created
-- ============================================================================

SELECT 
    tablename,
    policyname,
    cmd AS command
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'product_templates',
    'option_groups',
    'options',
    'configurations'
)
ORDER BY tablename, policyname;

-- Expected: 15+ rows (multiple policies per table)


-- ============================================================================
-- ✅ SUCCESS CRITERIA
-- ============================================================================
-- If you see:
-- - 8 tables in Step 1
-- - 3 functions in Step 2  
-- - 15+ policies in Step 3
-- 
-- Then migration was SUCCESSFUL! 🎉
-- 
-- Next: Load sample data (Gaming PC template)
