
-- Migration: 100_rbac_schema.sql
-- Description: Creates the RBAC infrastructure (Permissions, Role Mappings).
-- Phase 4 of ERP Foundation.

BEGIN;

-- 1. Create Permissions Table
-- Defines ALL possible actions in the system.
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY, -- e.g., 'contacts.read', 'contacts.delete'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Create Role-Permissions Mapping
-- Defines which Role gets which Permission.
CREATE TABLE IF NOT EXISTS role_permissions (
    role app_role NOT NULL, -- Enum: 'distributor', 'dealer', 'agent', 'customer'
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

-- 3. Helper Function: Check Permission
-- Returns TRUE if the current user has the requested permission.
-- Optimized to be used in RLS policies.
-- Defined in PUBLIC schema to avoid permission issues with "auth" schema.
CREATE OR REPLACE FUNCTION public.has_permission(requested_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role app_role;
BEGIN
    -- 1. Get User Role
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- 2. Check Mapping
    RETURN EXISTS (
        SELECT 1 
        FROM public.role_permissions 
        WHERE role = user_role 
        AND permission_id = requested_permission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users so RLS can use it
GRANT EXECUTE ON FUNCTION public.has_permission TO authenticated;


-- 4. SEED DATA: Define Permissions
INSERT INTO permissions (id, description) VALUES
    ('contacts.read', 'View contact details'),
    ('contacts.create', 'Create new contacts'),
    ('contacts.update', 'Edit existing contacts'),
    ('contacts.delete', 'Delete contacts (Hard Delete)'),
    ('export.data', 'Export data to CSV/Excel')
ON CONFLICT (id) DO NOTHING;

-- 5. SEED DATA: Assign Permissions to Roles

-- A. Distributor (Full Access)
INSERT INTO role_permissions (role, permission_id) VALUES
    ('distributor', 'contacts.read'),
    ('distributor', 'contacts.create'),
    ('distributor', 'contacts.update'),
    ('distributor', 'contacts.delete'),
    ('distributor', 'export.data')
ON CONFLICT DO NOTHING;

-- B. Dealer (Standard Access - No Delete)
INSERT INTO role_permissions (role, permission_id) VALUES
    ('dealer', 'contacts.read'),
    ('dealer', 'contacts.create'),
    ('dealer', 'contacts.update')
    -- No Delete, No Export
ON CONFLICT DO NOTHING;

-- C. Agent (Standard Access)
INSERT INTO role_permissions (role, permission_id) VALUES
    ('agent', 'contacts.read'),
    ('agent', 'contacts.create'),
    ('agent', 'contacts.update')
ON CONFLICT DO NOTHING;

-- D. Customer (Self Service - Read Only/Edit Self)
INSERT INTO role_permissions (role, permission_id) VALUES
    ('customer', 'contacts.read'), -- Can read own card
    ('customer', 'contacts.update') -- Can update own card (portal)
ON CONFLICT DO NOTHING;

COMMIT;
