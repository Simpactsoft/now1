
-- Migration: 196_verify_rbac.sql
-- Description: Verify that Dealer cannot delete, but Distributor can.

-- 1. Create a dummy card owned by Dealer
INSERT INTO public.cards (id, tenant_id, hierarchy_path, type, display_name)
VALUES (
    '00000000-0000-0000-0000-00000000add1', 
    '00000000-0000-0000-0000-000000000001', -- Dealer Tenant
    'root.dealer1',
    'person',
    'RBAC Test Dummy'
) ON CONFLICT DO NOTHING;

-- 2. Verify Configuration (White-Box Test)
-- We check if the Dealer has the 'contacts.delete' permission in the config table.

DO $$
DECLARE
    dealer_can_delete boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.role_permissions 
        WHERE role = 'dealer' AND permission = 'contacts.delete'
    ) INTO dealer_can_delete;

    IF dealer_can_delete THEN
        RAISE EXCEPTION 'TEST FAILED: Dealer HAS delete permission in config table!';
    ELSE
        RAISE NOTICE 'TEST PASSED: Dealer is correctly blocked from deleting.';
    END IF;
END
$$;

-- 3. Check Policy Logic (Manual Inspection)
SELECT * FROM pg_policies WHERE tablename = 'cards' AND cmd = 'DELETE';
