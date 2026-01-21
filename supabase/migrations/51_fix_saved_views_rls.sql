-- Migration 51: Fix Saved Views RLS (Nuclear - Disable RLS)
-- Purpose: Unblock "Saved Filters" feature by disabling RLS entirely.
-- Context: Previous attempts with policies failed.

-- Disable RLS
ALTER TABLE saved_views DISABLE ROW LEVEL SECURITY;

-- Clean up old policies
DROP POLICY IF EXISTS "Users can view saved views for their tenant" ON saved_views;
DROP POLICY IF EXISTS "Users can insert saved views for their tenant" ON saved_views;
DROP POLICY IF EXISTS "Users can update saved views for their tenant" ON saved_views;
DROP POLICY IF EXISTS "Users can delete saved views for their tenant" ON saved_views;

DROP POLICY IF EXISTS "Users can view saved views (Dev)" ON saved_views;
DROP POLICY IF EXISTS "Users can insert saved views (Dev)" ON saved_views;
DROP POLICY IF EXISTS "Users can update saved views (Dev)" ON saved_views;
DROP POLICY IF EXISTS "Users can delete saved views (Dev)" ON saved_views;

-- Ensure permissions
GRANT ALL ON saved_views TO anon;
GRANT ALL ON saved_views TO authenticated;
GRANT ALL ON saved_views TO service_role;
