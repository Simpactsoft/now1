
-- Migration: 175_force_assign_dealer_data.sql
-- Description: Forced alignment of misaligned cards to Noam's Tenant/Path.

BEGIN;

DO $$
DECLARE
    v_noam_tenant uuid;
BEGIN
    SELECT tenant_id INTO v_noam_tenant
    FROM profiles WHERE email = 'noam@dd.com';

    -- 1. Fix the "Lost" cards (Itzhak, Shoshana, etc.)
    -- Identify them by being at 'org' (Root) and created recently
    UPDATE cards
    SET 
        tenant_id = v_noam_tenant,
        hierarchy_path = 'org.dealer1'
    WHERE hierarchy_path = 'org'
    AND created_at > (now() - interval '24 hours')
    AND type = 'person';

    RAISE NOTICE 'Fixed lost cards. Now all should be at org.dealer1 with Tenant %', v_noam_tenant;

END $$;

COMMIT;
