-- Fix RLS policies for option_groups and options
-- This will allow the API to read them

-- First, check what policies exist
-- SELECT * FROM pg_policies WHERE tablename IN ('option_groups', 'options');

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view option_groups for their tenant" ON option_groups;
DROP POLICY IF EXISTS "Users can view options for their tenant" ON options;

-- Create permissive SELECT policies for option_groups
CREATE POLICY "Allow read access to option_groups"
ON option_groups FOR SELECT
TO authenticated
USING (true);  -- Allow all authenticated users to read

-- Create permissive SELECT policies for options  
CREATE POLICY "Allow read access to options"
ON options FOR SELECT
TO authenticated
USING (true);  -- Allow all authenticated users to read

-- Verify the new policies
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('option_groups', 'options')
ORDER BY tablename, policyname;
