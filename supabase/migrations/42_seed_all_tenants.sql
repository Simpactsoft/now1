-- Phase 20 Fix: Seed ALL Tenants (Universal Visibility)
-- Ensures that no matter which tenant you are viewing, you see data.

DO $$
DECLARE
    t_rec RECORD;
BEGIN
    -- Loop through ALL tenants
    FOR t_rec IN SELECT id FROM tenants LOOP
        RAISE NOTICE 'Seeding Tenant: %', t_rec.id;

        -- 1. Spread Dates (Last 2 years)
        UPDATE parties
        SET created_at = NOW() - (random() * 730 || ' days')::interval,
            updated_at = NOW()
        WHERE tenant_id = t_rec.id;

        -- 2. CRM Data (Status, Rating, Tags)
        UPDATE parties
        SET status = (ARRAY['lead', 'customer', 'churned', 'partner', 'negotiation'])[floor(random() * 5 + 1)],
            rating = floor(random() * 5 + 1)::int,
            tags = ARRAY[
                (ARRAY['VIP', 'Urgent', 'New', 'Referral'])[floor(random() * 4 + 1)],
                (ARRAY['2024', '2025', 'Q1', 'Q2'])[floor(random() * 4 + 1)]
            ]
        WHERE tenant_id = t_rec.id;
        
        -- 3. Party Memberships (Roles)
        UPDATE party_memberships
        SET role_name = (ARRAY['Developer', 'Manager', 'Sales', 'Director', 'Admin'])[floor(random() * 5 + 1)]
        WHERE tenant_id = t_rec.id;
        
        -- 4. Organizations (Industry)
        UPDATE organizations_ext
        SET company_size = (ARRAY['1-10', '11-50', '51-200', '500+'])[floor(random() * 4 + 1)],
            industry = (ARRAY['Tech', 'Finance', 'Health', 'Retail'])[floor(random() * 4 + 1)]
        WHERE party_id IN (SELECT id FROM parties WHERE tenant_id = t_rec.id AND type = 'organization');
        
    END LOOP;
END $$;
