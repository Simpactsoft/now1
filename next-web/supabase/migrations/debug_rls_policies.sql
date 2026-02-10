-- Check RLS policies on bom_items and bom_headers
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('bom_items', 'bom_headers', 'products')
ORDER BY tablename, policyname;
