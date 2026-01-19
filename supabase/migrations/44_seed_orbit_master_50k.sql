-- Phase 22: Master Seed - Orbit Enterprise (20k Records)
-- Optimized: Compact Strings, No Trailing Drops, Reduced Count to avoid Timeout

-- 1. Create Config Temp Table
CREATE TEMP TABLE IF NOT EXISTS _cfg AS SELECT id as tid FROM tenants WHERE name = 'Orbit Enterprise' LIMIT 1;
INSERT INTO _cfg (tid) SELECT id FROM tenants WHERE name ILIKE 'Orbit Enterprise%' AND NOT EXISTS (SELECT 1 FROM _cfg) LIMIT 1;

-- 2. Cleanup
DELETE FROM party_memberships WHERE tenant_id IN (SELECT tid FROM _cfg);
DELETE FROM people WHERE party_id IN (SELECT id FROM parties WHERE tenant_id IN (SELECT tid FROM _cfg));
DELETE FROM parties WHERE tenant_id IN (SELECT tid FROM _cfg) AND type = 'person';

-- 3. Prepare Org IDs
CREATE TEMP TABLE IF NOT EXISTS _orgs AS SELECT array_agg(id) as ids FROM parties WHERE tenant_id IN (SELECT tid FROM _cfg) AND type = 'organization';

-- 4. Generate Data
CREATE TEMP TABLE IF NOT EXISTS _batch AS
SELECT
    gen_random_uuid() as id,
    (SELECT tid FROM _cfg) as tenant_id,
    
    CASE WHEN random() < 0.5 THEN (ARRAY['Yossi', 'David', 'Moshe', 'Avraham', 'Yitzhak', 'Yaakov', 'Sarah', 'Rachel', 'Leah', 'Rivka', 'Noa', 'Tamar', 'Maya', 'Ori', 'Idan', 'Amit'])[floor(random()*16+1)] ELSE (ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica'])[floor(random()*18+1)] END as first_name,
    
    CASE WHEN random() < 0.5 THEN (ARRAY['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Katz', 'Azoulay', 'Gabay', 'Hadad', 'Friedman'])[floor(random()*11+1)] ELSE (ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez'])[floor(random()*11+1)] END as last_name,

    (ARRAY['lead', 'customer', 'churned', 'partner', 'negotiation'])[floor(random()*5+1)] as status,

    CASE WHEN random() > 0.98 THEN ARRAY[(ARRAY['VIP', 'Whale', 'Urgent', 'Decision Maker'])[floor(random()*4+1)::int], (ARRAY['Risk', 'High Value'])[floor(random()*2+1)::int], (ARRAY['Q4 Close'])[floor(random()*1+1)::int]] WHEN random() > 0.93 THEN ARRAY[(ARRAY['New', 'Referral', 'Online', 'Event'])[floor(random()*4+1)::int], (ARRAY['Follow Up'])[floor(random()*1+1)::int]] ELSE ARRAY[]::text[] END as tags,

    NOW() - (random() * 1000 || ' days')::interval as created_at,
    NOW() - (random() * 100 || ' days')::interval as updated_at
FROM generate_series(1, 1000)
WHERE EXISTS (SELECT 1 FROM _cfg);

-- 5. Insert
INSERT INTO parties (id, tenant_id, type, display_name, contact_methods, custom_fields, created_at, updated_at, tags, status)
SELECT id, tenant_id, 'person', first_name || ' ' || last_name, '[]'::jsonb, '{}'::jsonb, created_at, updated_at, tags, status FROM _batch;

INSERT INTO people (party_id, first_name, last_name)
SELECT id, first_name, last_name FROM _batch;

INSERT INTO party_memberships (tenant_id, person_id, organization_id, role_name, created_at)
SELECT tenant_id, id, (SELECT ids FROM _orgs)[floor(random() * array_length((SELECT ids FROM _orgs), 1) + 1)], (ARRAY['Developer', 'Manager', 'Director', 'VP Sales', 'CEO', 'CTO', 'Designer', 'Product Manager'])[floor(random()*8+1)], created_at
FROM _batch WHERE EXISTS (SELECT 1 FROM _orgs WHERE ids IS NOT NULL);

-- Final Check
SELECT count(*) as seeded_count FROM parties WHERE tenant_id IN (SELECT tid FROM _cfg);
