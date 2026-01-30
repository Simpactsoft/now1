
-- Migration: 165_fix_user_credentials.sql
-- Description: Updates the 'im44pact' user to be 'sales@impactsoft.co.il' with strong credentials.
-- Also auto-confirms the email so you can login immediately.

BEGIN;

UPDATE auth.users
SET 
    email = 'sales@impactsoft.co.il',
    encrypted_password = crypt('ImpactSoft@2026!', gen_salt('bf')),
    email_confirmed_at = now(), -- Ensure it's verified
    raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb), 
        '{name}', 
        '"ImpactSoft Sales"'
    )
WHERE email = 'im44pact.art@gmail.com';

-- Verification
DO $$
DECLARE
    v_found text;
BEGIN
    SELECT email INTO v_found FROM auth.users WHERE email = 'sales@impactsoft.co.il';
    IF v_found IS NOT NULL THEN
        RAISE NOTICE 'SUCCESS: User Updated.';
        RAISE NOTICE 'Email: sales@impactsoft.co.il';
        RAISE NOTICE 'Pass: ImpactSoft@2026!';
    ELSE
        RAISE EXCEPTION 'Update failed - User not found.';
    END IF;
END $$;

COMMIT;
