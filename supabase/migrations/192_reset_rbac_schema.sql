
-- Migration: 192_reset_rbac_schema.sql
-- Description: Drop and Recreate RBAC tables to fix schema mismatch (permission_id vs permission).

-- 1. Clean Slate
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.permissions;

-- 2. Permissions Dictionary
CREATE TABLE public.permissions (
    id text PRIMARY KEY, -- e.g. 'contacts.create'
    description text
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Read Authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);


-- 3. Role -> Permissions Mapping
CREATE TABLE public.role_permissions (
    role public.app_role NOT NULL,
    permission text NOT NULL REFERENCES public.permissions(id),
    PRIMARY KEY (role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Read Authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);


-- 4. Seed Permissions
INSERT INTO public.permissions (id, description) VALUES
('contacts.read', 'View contact details'),
('contacts.create', 'Create new contacts'),
('contacts.update', 'Edit existing contacts'),
('contacts.delete', 'Delete contacts'),
('export.data', 'Export data to CSV/Excel');


-- 5. Seed Role Mappings

-- Distributor (Admin-like): Can do everything
INSERT INTO public.role_permissions (role, permission) VALUES
('distributor', 'contacts.read'),
('distributor', 'contacts.create'),
('distributor', 'contacts.update'),
('distributor', 'contacts.delete'),
('distributor', 'export.data');

-- Dealer: Can View/Edit/Create, NO Delete, NO Export
INSERT INTO public.role_permissions (role, permission) VALUES
('dealer', 'contacts.read'),
('dealer', 'contacts.create'),
('dealer', 'contacts.update');

-- Agent: Same as Dealer for now
INSERT INTO public.role_permissions (role, permission) VALUES
('agent', 'contacts.read'),
('agent', 'contacts.create'),
('agent', 'contacts.update');
