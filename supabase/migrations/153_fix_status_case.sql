
-- Migration: 153_fix_status_case.sql
-- Description: Fixes Status Display Issue.
-- The Frontend expects UPPERCASE statuses (LEAD, CUSTOMER), but seeded data was lowercase.
-- This caused badges to disappear (Blank Status) even though filtering worked.

BEGIN;

-- 1. Normalize Statuses to Uppercase
-- Also handle NULLs by defaulting to 'LEAD'
UPDATE public.cards
SET status = COALESCE(UPPER(status), 'LEAD');

-- 2. Verify
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT status, count(*) as c FROM cards GROUP BY status LOOP
        RAISE NOTICE 'Status: % (Count: %)', r.status, r.c;
    END LOOP;
END $$;

COMMIT;
