
-- Migration: 123_rescue_ghosts.sql
-- Description: Uses Audit Logs forensics to recover "Ghost" records (like 'Noam') that have NULL agent_id or Wrong Tenant.

BEGIN;

-- 1. "CSI: Database" - Identify Creators from Audit Logs
-- If a card has NO agent_id, try to find who created it from the logs.
UPDATE cards c
SET agent_id = al.performed_by
FROM audit_logs al
WHERE c.id = al.record_id
AND al.operation = 'INSERT'
AND al.table_name = 'cards'
AND c.agent_id IS NULL;

-- 2. "Repatriation" - Move records to the Creator's Tenant
-- Now that we restored agent_id (or if it existed), ensure the card resides in the Agent's valid tenant.
UPDATE cards c
SET tenant_id = p.tenant_id
FROM profiles p
WHERE c.agent_id = p.id
AND c.tenant_id != p.tenant_id;

-- 3. Cleanup: Update Unique Identifiers (Email/Phone) to match the new Tenant
-- If we moved the card, the unique constraints (email+tenant) might be stale in unique_identifiers table.
-- We update them to match the card's new tenant.
UPDATE unique_identifiers ui
SET tenant_id = c.tenant_id
FROM cards c
WHERE ui.card_id = c.id
AND ui.tenant_id != c.tenant_id;

COMMIT;
