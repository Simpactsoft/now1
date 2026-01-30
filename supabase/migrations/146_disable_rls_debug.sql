
-- Migration: 146_disable_rls_debug.sql
-- Description: NUCLEAR DIAGNOSTIC.
-- Disables RLS on the main table to checking if Permissions are the blocker.

BEGIN;

-- 1. Disable RLS on the table (Data becomes public to valid SQL queries)
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;

-- 2. Log that we did this (Verification)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tenant_id, count(*) as c FROM cards GROUP BY tenant_id LOOP
        RAISE NOTICE '[DEBUG] Tenant % has % cards (RLS DISABLED)', r.tenant_id, r.c;
    END LOOP;
END $$;

COMMIT;
