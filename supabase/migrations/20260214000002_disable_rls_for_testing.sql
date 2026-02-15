-- TEMPORARY: Disable RLS on product_templates for troubleshooting
-- This allows us to test if the issue is with RLS or something else
-- IMPORTANT: Re-enable RLS after testing!

ALTER TABLE product_templates DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
-- ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
