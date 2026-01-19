-- Phase 20 Example Data: Diversify "Orbit" Tenant Data for Analytics Testing
-- Randomizes dates, statuses, and roles to enable meaningful grouping tests.

DO $$
DECLARE
    orbit_id UUID;
BEGIN
    -- 1. Find the "Orbit" tenant (assuming it exists, otherwise picks the largest one)
    SELECT id INTO orbit_id FROM tenants ORDER BY created_at ASC LIMIT 1;
    
    RAISE NOTICE 'Diversifying data for Tenant: %', orbit_id;

    -- 2. Randomize "created_at" (Join Date) over the last 3 years
    -- This enables Year/Quarter/Month grouping
    UPDATE parties
    SET created_at = NOW() - (random() * 1000 || ' days')::interval,
        updated_at = NOW() - (random() * 100 || ' days')::interval
    WHERE tenant_id = orbit_id;

    -- 3. Randomize CRM Status
    UPDATE parties
    SET status = (ARRAY['lead', 'customer', 'churned', 'negotiation', 'partner'])[floor(random() * 5 + 1)],
        rating = floor(random() * 5 + 1)::int
    WHERE tenant_id = orbit_id;

    -- 4. Improve Role Diversity (for Party Memberships)
    -- Updates existing memberships to have varied roles
    UPDATE party_memberships
    SET role_name = (ARRAY['Developer', 'Senior Manager', 'Sales Rep', 'Designer', 'Executive', 'Consultant', 'Intern'])[floor(random() * 7 + 1)]
    WHERE tenant_id = orbit_id;

    -- 5. Randomize Organization Info for Company Size Grouping
    UPDATE organizations_ext
    SET company_size = (ARRAY['1-10', '11-50', '51-200', '201-1000', '1000+'])[floor(random() * 5 + 1)],
        industry = (ARRAY['Tech', 'Finance', 'Health', 'Retail', 'Energy'])[floor(random() * 5 + 1)]
    WHERE party_id IN (SELECT id FROM parties WHERE tenant_id = orbit_id AND type = 'organization');

    -- Refresh Materialized Views (if any - optional future step)
    
END $$;
