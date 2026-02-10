-- Temporarily disable RLS on BOM tables for testing
ALTER TABLE bom_headers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('bom_headers', 'bom_items');
