-- Disable RLS on saved_views table
ALTER TABLE saved_views DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to all roles (for Development)
GRANT ALL ON saved_views TO anon;
GRANT ALL ON saved_views TO authenticated;
GRANT ALL ON saved_views TO service_role;
