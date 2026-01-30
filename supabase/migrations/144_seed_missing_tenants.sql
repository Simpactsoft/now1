
-- Migration: 144_seed_missing_tenants.sql
-- Description: 
-- The previous seed only populated the FIRST tenant it found.
-- This script loops through ALL tenants in 'profiles' and seeds data for any that are currently empty.

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID;
    v_rec RECORD;
    v_already_has_data BOOLEAN;
    
    -- Names Arrays (Reuse)
    v_first_names_he TEXT[] := ARRAY['Noam', 'Yossi', 'David', 'Rachel', 'Sara', 'Moshe', 'Haim', 'Dana', 'Noa', 'Tamar', 'Eyal', 'Omer'];
    v_last_names_he TEXT[] := ARRAY['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Katz', 'Azoulay', 'Gabay', 'Hadad'];
    v_first_names_en TEXT[] := ARRAY['John', 'Michael', 'Emily', 'Sarah', 'David', 'James', 'Emma', 'Olivia', 'Daniel', 'Sophia'];
    v_last_names_en TEXT[] := ARRAY['Smith', 'Johnson', 'Brown', 'Williams', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];
    v_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'outlook.com', 'walla.co.il', 'company.com'];
    v_statuses TEXT[] := ARRAY['lead', 'lead', 'lead', 'customer', 'customer', 'dealer_prospect', 'active'];
    v_tags TEXT[] := ARRAY['VIP', 'Urgent', 'New', 'FollowUp', 'Referral'];
    
    v_counter INT;
    v_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_status TEXT;
    v_chosen_tags TEXT[];
    v_hierarchy_path LTREE;
BEGIN
    -- Loop through ALL distinct tenants found in profiles
    FOR v_tenant_id IN SELECT DISTINCT tenant_id FROM public.profiles WHERE tenant_id IS NOT NULL LOOP
        
        -- Check if this tenant already has data
        SELECT EXISTS(SELECT 1 FROM public.cards WHERE tenant_id = v_tenant_id LIMIT 1) INTO v_already_has_data;
        
        IF v_already_has_data THEN
            RAISE NOTICE 'Tenant % already has data. Skipping.', v_tenant_id;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Seeding 5,000 records for Tenant: %', v_tenant_id;
        
        -- Default Path (Root)
        v_hierarchy_path := 'org'::ltree;

        -- Generate 5,000 Records (Slightly fewer to be fast)
        FOR v_counter IN 1..5000 LOOP
            
            -- Pick Name
            IF (random() > 0.5) THEN
                v_name := v_first_names_he[floor(random()*array_length(v_first_names_he, 1) + 1)] || ' ' || 
                          v_last_names_he[floor(random()*array_length(v_last_names_he, 1) + 1)];
            ELSE
                v_name := v_first_names_en[floor(random()*array_length(v_first_names_en, 1) + 1)] || ' ' || 
                          v_last_names_en[floor(random()*array_length(v_last_names_en, 1) + 1)];
            END IF;

            -- Generate Contact Info
            v_email := lower(replace(v_name, ' ', '.')) || v_counter || '@' || v_domains[floor(random()*array_length(v_domains, 1) + 1)];
            v_phone := '+972-5' || floor(random()*9 + 0)::text || '-' || floor(random()*8999999 + 1000000)::text;
            v_status := v_statuses[floor(random()*array_length(v_statuses, 1) + 1)];

            -- Pick Tags
            v_chosen_tags := ARRAY[]::text[];
            IF (random() < 0.05) THEN
                v_chosen_tags := ARRAY[v_tags[floor(random()*array_length(v_tags, 1) + 1)]];
            END IF;

            -- INSERT
            INSERT INTO public.cards (
                tenant_id, 
                type, 
                hierarchy_path, 
                display_name, 
                status, 
                contact_methods, 
                tags,
                created_at
            ) VALUES (
                v_tenant_id,
                'person',
                v_hierarchy_path,
                v_name,
                v_status,
                jsonb_build_object('email', v_email, 'phone', v_phone),
                v_chosen_tags,
                NOW() - (random() * interval '365 days')
            );
            
        END LOOP;
        
    END LOOP;
    
END $$;

ANALYZE public.cards;

COMMIT;
