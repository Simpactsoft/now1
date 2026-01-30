
-- Migration: 170_simulate_dealer_query.sql
-- Description: Simulates being 'noam@dd.com' and runs a count query.
-- Purpose: Determine if RLS leak is in DB or Frontend.

BEGIN;

DO $$
DECLARE
    v_noam_id uuid;
    v_count bigint;
    v_path ltree;
BEGIN
    -- 1. Get Noam's ID and Path
    SELECT id, org_path INTO v_noam_id, v_path 
    FROM profiles 
    WHERE email = 'noam@dd.com';

    IF v_noam_id IS NULL THEN
        RAISE EXCEPTION 'Noam not found!';
    END IF;

    RAISE NOTICE 'Debugging as User: % (Path: %)', v_noam_id, v_path;

    -- 2. Simulate Login (Set Config for RLS)
    -- This mimics what Supabase does per request
    PERFORM set_config('request.jwt.claim.sub', v_noam_id::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- 3. Run the "Leaking" Query
    -- Direct Select from cards
    SELECT count(*) INTO v_count FROM cards;
    
    RAISE NOTICE 'Direct Count from CARDS table: %', v_count;

    -- 4. Run via RPC (if accessible)
    -- Note: Calling RPC from PLPGSQL block is tricky with context, 
    -- but the count above is the ultimate truth for RLS.

    IF v_count > 1000 THEN
        RAISE NOTICE 'FAILURE: Noam sees too many rows! RLS is broken.';
    ELSE
        RAISE NOTICE 'SUCCESS: Noam sees restricted rows. DB is Safe.';
    END IF;

END $$;

ROLLBACK; -- Always rollback so we don't mess up session state
