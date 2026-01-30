
-- Migration: 142_fresh_start_seed.sql
-- Description: The "Nuclear Option".
-- 1. DROPS legacy 'cards' and 'research' schema.
-- 2. PROMOTES 'cards_new' to 'cards'.
-- 3. SEEDS realistic data (Hebrew/English) for the current user.

BEGIN;

-- =================================================================
-- PART A: CLEANUP & CUTOVER
-- =================================================================

-- 1. Drop old Legacy table if it exists
DROP TABLE IF EXISTS public.cards CASCADE;

-- 2. Drop Research Sandbox if it exists
DROP SCHEMA IF EXISTS research CASCADE;

-- 3. Promote 'cards_new' to 'cards'
-- Make sure 141 ran first. If cards_new doesn't exist, this will fail (good).
ALTER TABLE public.cards_new RENAME TO cards;

-- 4. Rename Indexes to be standard
ALTER INDEX idx_cards_new_tenant_hierarchy RENAME TO idx_cards_tenant_hierarchy;
ALTER INDEX idx_cards_new_tenant_created RENAME TO idx_cards_tenant_created;
ALTER INDEX idx_cards_new_contact_gin RENAME TO idx_cards_contact_gin;
ALTER INDEX idx_cards_new_fts_gin RENAME TO idx_cards_fts_gin;


-- =================================================================
-- PART B: REALISTIC SEEDING
-- =================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_rec RECORD;
    
    -- Names Arrays
    v_first_names_he TEXT[] := ARRAY['Noam', 'Yossi', 'David', 'Rachel', 'Sara', 'Moshe', 'Haim', 'Dana', 'Noa', 'Tamar', 'Eyal', 'Omer'];
    v_last_names_he TEXT[] := ARRAY['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Katz', 'Azoulay', 'Gabay', 'Hadad'];
    
    v_first_names_en TEXT[] := ARRAY['John', 'Michael', 'Emily', 'Sarah', 'David', 'James', 'Emma', 'Olivia', 'Daniel', 'Sophia'];
    v_last_names_en TEXT[] := ARRAY['Smith', 'Johnson', 'Brown', 'Williams', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];
    
    -- Other Arrays
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
    -- 1. Get Tenant ID (Use the one from Profiles logic, usually the first one found)
    -- If no profiles exist, we can't seed effectively for a user.
    SELECT tenant_id INTO v_tenant_id FROM public.profiles LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'No Tenant ID found in profiles. Skipping seed.';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding data for Tenant: %', v_tenant_id;
    
    -- Default Path (Root)
    v_hierarchy_path := 'org'::ltree;

    -- 2. Generate 10,000 Records
    FOR v_counter IN 1..10000 LOOP
        
        -- A. Pick Name (50% Hebrew, 50% English)
        IF (random() > 0.5) THEN
            v_name := v_first_names_he[floor(random()*array_length(v_first_names_he, 1) + 1)] || ' ' || 
                      v_last_names_he[floor(random()*array_length(v_last_names_he, 1) + 1)];
        ELSE
            v_name := v_first_names_en[floor(random()*array_length(v_first_names_en, 1) + 1)] || ' ' || 
                      v_last_names_en[floor(random()*array_length(v_last_names_en, 1) + 1)];
        END IF;

        -- B. Generate Email
        v_email := lower(replace(v_name, ' ', '.')) || v_counter || '@' || v_domains[floor(random()*array_length(v_domains, 1) + 1)];
        
        -- C. Generate Phone
        v_phone := '+972-5' || floor(random()*9 + 0)::text || '-' || floor(random()*8999999 + 1000000)::text;

        -- D. Pick Status
        v_status := v_statuses[floor(random()*array_length(v_statuses, 1) + 1)];

        -- E. Pick Tags (5% chance)
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
            NOW() - (random() * interval '365 days') -- Random date in last year
        );
        
    END LOOP;

    -- 3. Assign Role to ~200 random people (simulate Admin interaction)
    -- We can't easily insert into party_memberships without valid user IDs, 
    -- but if we had real users we would do it here.
    -- For now, skipping role assignment as it requires 'auth.users' linkage mostly.
    
END $$;

ANALYZE public.cards;

COMMIT;
