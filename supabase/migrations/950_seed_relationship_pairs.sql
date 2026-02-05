
-- Migration: 950_seed_relationship_pairs.sql
-- Description: Seed correct reverse names for relationship types to support reciprocal role display.

DO $$
DECLARE
    t_id uuid;
BEGIN
    -- Iterate over all tenants to ensure data is fixed for everyone
    FOR t_id IN SELECT id FROM tenants LOOP
        
        -- 1. Professional: Employee <-> Employer
        -- We insert both directions to handle potential existing data mismatch
        
        -- Employee -> Employer
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Employee', 'Employer', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Employer', is_directional = true;

        -- Employer -> Employee
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Employer', 'Employee', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Employee', is_directional = true;


        -- 2. Investor: Investor <-> Portfolio Company
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Investor', 'Portfolio Company', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Portfolio Company';

        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Portfolio Company', 'Investor', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Investor';


        -- 3. Governance: Board Member <-> Board
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Board Member', 'Board', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Board';
        
        -- 4. Contractor <-> Company
        INSERT INTO relationship_types (tenant_id, name, reverse_name, is_directional)
        VALUES (t_id, 'Contractor', 'Company', true)
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET reverse_name = 'Company';

    END LOOP;
END $$;
