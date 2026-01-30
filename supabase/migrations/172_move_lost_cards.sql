
-- Migration: 172_move_lost_cards.sql
-- Description: Moves cards created by Noam (or recent orphans) to 'org.dealer1'.

BEGIN;

DO $$
DECLARE
    v_noam_id uuid;
    v_noam_tenant uuid;
BEGIN
    SELECT id, tenant_id INTO v_noam_id, v_noam_tenant
    FROM profiles WHERE email = 'noam@dd.com';

    -- 1. Move recent cards (created last 24h) that are 'org' to 'org.dealer1'
    -- IF they belong to Noam's tenant.
    UPDATE cards
    SET hierarchy_path = 'org.dealer1'
    WHERE tenant_id = v_noam_tenant
    AND hierarchy_path = 'org' 
    AND created_at > (now() - interval '24 hours');

    -- 2. Also ensure tenant consistency (if any cards drifted)
    -- Align cards to Noam's tenant if created by him (assuming we track creator)
    -- Since we don't strictly track 'created_by_user_id' in simple schema, 
    -- we rely on the tenant filter updates above.

    RAISE NOTICE 'Moved lost cards to org.dealer1 for tenant %', v_noam_tenant;
END $$;

COMMIT;
