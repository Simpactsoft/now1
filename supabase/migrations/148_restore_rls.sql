
-- Migration: 148_restore_rls.sql
-- Description: Re-enables Row Level Security (RLS) on the cards table.
-- This restricts visibility to only the user's tenant/hierarchy.
-- Corrects the count from ~15,000 (Global) back to ~5,000 (Tenant).

BEGIN;

-- 1. Re-enable RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- 2. Verify settings (Optional logging)
DO $$
BEGIN
    RAISE NOTICE 'RLS Enabled on cards table.';
END $$;

COMMIT;
