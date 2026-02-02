
-- Migration: 227_force_refresh.sql
-- Description: Force PostgREST schema cache reload.

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';

-- Simple test function to verify RPC system is healthy
CREATE OR REPLACE FUNCTION test_rpc_connection()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION test_rpc_connection() TO authenticated, anon;
