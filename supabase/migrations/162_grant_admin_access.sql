
-- Migration: 162_grant_admin_access.sql (Corrected)
-- Description: Promotes 'im44pact.art@gmail.com' to Admin.

BEGIN;

DO $$
DECLARE
    v_target_email text := 'im44pact.art@gmail.com';
    v_uid uuid;
BEGIN
    -- 1. Find the User ID
    SELECT id INTO v_uid
    FROM auth.users
    WHERE email = v_target_email;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'User % still not found (This should not happen now)!', v_target_email;
    END IF;

    -- 2. Update Profile to Admin (Root Path)
    UPDATE public.profiles
    SET org_path = 'org'::ltree
    WHERE id = v_uid;

    RAISE NOTICE 'SUCCESS: % (ID: %) is now an Admin.', v_target_email, v_uid;
END $$;

COMMIT;
