-- Migration: 198_add_user_management_permission.sql
-- Description: Add permission to manage users (Invite, Revoke, Change Role).

-- 1. Add Permission
INSERT INTO public.permissions (id, description)
VALUES ('users.manage', 'Invite users and manage team roles')
ON CONFLICT (id) DO NOTHING;

-- 2. Grant to Distributor (Admin)
INSERT INTO public.role_permissions (role, permission)
VALUES ('distributor', 'users.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- Not granting to Dealer/Agent.
