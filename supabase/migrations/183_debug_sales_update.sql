
-- Migration: 183_debug_sales_update.sql
-- Description: Find the user by partial match and forcefully update name.

DO $$
DECLARE
    target_id uuid;
    old_name text;
BEGIN
    -- 1. Find the user ID (ignore case, ignore whitespace)
    SELECT id, first_name || ' ' || last_name INTO target_id, old_name
    FROM profiles
    WHERE lower(trim(email)) = 'sales@impactsoft.co.il';

    IF target_id IS NULL THEN
        RAISE NOTICE 'User not found! Searching broadly...';
        -- Optional: print all admins
        RETURN;
    END IF;

    RAISE NOTICE 'Found User: % (Name: %)', target_id, old_name;

    -- 2. Update
    UPDATE profiles
    SET 
        first_name = 'System',
        last_name = 'Admin'
    WHERE id = target_id;

    RAISE NOTICE 'Update executed.';
END $$;

-- Verify Results
SELECT email, first_name, last_name, role 
FROM profiles 
WHERE lower(trim(email)) LIKE 'sales%';
