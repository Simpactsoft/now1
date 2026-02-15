-- Migration: 231_fix_configuration_rules_rls.sql
-- Description: Fix RLS policies for configuration_rules to work with current auth setup

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage rules" ON configuration_rules;
DROP POLICY IF EXISTS "Users can view active rules for templates" ON configuration_rules;

-- Create new policy that allows distributors, admins, and super_admins to manage rules
CREATE POLICY "Admins and distributors can manage rules"
    ON configuration_rules FOR ALL
    USING (
        tenant_id = (auth.jwt()->>'tenant_id')::uuid
        AND (
            (auth.jwt()->>'role')::text IN ('admin', 'distributor', 'super_admin')
            OR (auth.jwt()->>'app_role')::text IN ('admin', 'distributor', 'super_admin')
        )
    );

-- Add super admin policy (email-based)
CREATE POLICY "Super admin can manage all rules"
    ON configuration_rules FOR ALL
    USING (
        auth.email() = 'sales@impactsoft.co.il'
    );

COMMENT ON POLICY "Admins and distributors can manage rules" ON configuration_rules 
    IS 'Allows admins, distributors, and super_admins to create/update/delete rules in their tenant';

COMMENT ON POLICY "Super admin can manage all rules" ON configuration_rules 
    IS 'Allows sales@impactsoft.co.il to manage all rules across all tenants';
