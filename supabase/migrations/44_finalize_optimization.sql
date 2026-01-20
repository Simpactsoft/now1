-- Migration 44: Finalize Optimization
-- Fixes: Inconsistent search performance due to stale statistics.

-- 1. Increase Timeout for the Search Function
-- 2 seconds is too aggressive for 1.6M rows on cold cache. We increase to 15s.
ALTER FUNCTION fetch_people_crm SET statement_timeout = '15s';

-- 2. Force Statistics Update
-- This tells Postgres: "The table has changed! Re-calculate how many rows exist."
-- This ensures the Query Planner knows to use the GIN Index we created.
ANALYZE parties;
ANALYZE party_memberships;

-- 3. (Optional) Re-verify Index Usage could be done here, but ANALYZE is the key.
