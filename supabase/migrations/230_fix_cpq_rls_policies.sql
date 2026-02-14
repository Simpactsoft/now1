-- Migration: 230_fix_cpq_rls_policies.sql
-- Description: Add RLS policies to allow distributors and super_admins to manage CPQ templates

-- Drop ALL existing policies for product_templates to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage templates" ON product_templates;
DROP POLICY IF EXISTS "Admins and distributors can manage templates" ON product_templates;
DROP POLICY IF EXISTS "Super admin can manage all templates" ON product_templates;
DROP POLICY IF EXISTS "Users can view active templates in their tenant" ON product_templates;

-- Create new policy that allows distributors, admins, and super_admins to manage templates
CREATE POLICY "Admins and distributors can manage templates"
    ON product_templates FOR ALL
    USING (
        tenant_id = (auth.jwt()->>'tenant_id')::uuid
        AND (
            (auth.jwt()->>'role')::text IN ('admin', 'distributor', 'super_admin')
            OR (auth.jwt()->>'app_role')::text IN ('admin', 'distributor', 'super_admin')
        )
    );

-- Add similar policy for tenant-level super admins (email-based)
-- Note: Using auth.email() instead of querying auth.users to avoid permission errors
CREATE POLICY "Super admin can manage all templates"
    ON product_templates FOR ALL
    USING (
        auth.email() = 'sales@impactsoft.co.il'
    );

COMMENT ON POLICY "Admins and distributors can manage templates" ON product_templates 
    IS 'Allows admins, distributors, and super_admins to create/update/delete templates in their tenant';

COMMENT ON POLICY "Super admin can manage all templates" ON product_templates 
    IS 'Allows sales@impactsoft.co.il to manage all templates across all tenants';
