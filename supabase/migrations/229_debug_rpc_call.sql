
-- Migration: 229_debug_rpc_call.sql
-- Description: Manually test the RPC to rule out frontend issues.

SET statement_timeout = 5000;

-- Nano Inc ID
SELECT * FROM fetch_organizations_crm(
    '4d145b9e-4a75-5567-a0af-bcc4a30891e5'::uuid, -- Nano Inc
    0,   -- Start
    10,  -- Limit
    'updated_at',
    'desc',
    '{}'::jsonb
);
