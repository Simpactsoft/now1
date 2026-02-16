-- Check if RLS policies exist and are correct for option_groups
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
WHERE tablename = 'option_groups'
ORDER BY policyname;
