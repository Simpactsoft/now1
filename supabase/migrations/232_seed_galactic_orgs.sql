
-- Migration: 232_seed_galactic_orgs.sql
-- Description: Seeds 3000 dummy organizations for 'Galactic Stress Test'.

BEGIN;

DO $$
DECLARE
    v_tenant_id uuid := '00000000-0000-0000-0000-000000000003'; -- Galactic Stress Test
    v_counter integer := 0;
    
    -- Arrays for random generation
    v_status text[] := ARRAY['ACTIVE', 'PROSPECT', 'PARTNER', 'CHURNED', 'ACTIVE', 'ACTIVE']; -- Weighted towards ACTIVE
    v_industry text[] := ARRAY['TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'RETAIL', 'REAL_ESTATE', 'MANUFACTURING', 'SERVICES'];
    v_size text[] := ARRAY['1_10', '11_50', '51_200', '201_500', '500_PLUS'];
    
    -- Name Parts
    v_en_prefixes text[] := ARRAY['Tech', 'Global', 'Next', 'Smart', 'Green', 'Future', 'Alpha', 'Omega', 'Prime', 'Dynamic'];
    v_en_suffixes text[] := ARRAY['Corp', 'Inc', 'Solutions', 'Systems', 'Ltd', 'Group', 'Industries', 'Holdings', 'Ventures'];
    
    v_he_prefixes text[] := ARRAY['חברת', 'קבוצת', 'מערכות', 'פתרונות', 'טכנולוגיות', 'אדיר', 'פסגות', 'נתיבי', 'אלפא'];
    v_he_suffixes text[] := ARRAY['בע״מ', 'החדשה', 'מתקדמות', 'ישראל', 'הצפון', 'הדרום', 'אינטרנשיונל', 'החזקות'];

    -- Loop Variables
    v_id uuid;
    v_name text;
    v_selected_status text;
    v_selected_industry text;
    v_selected_size text;
    v_is_hebrew boolean;
BEGIN
    RAISE NOTICE 'Seeding 3000 organizations for Tenant ID: %', v_tenant_id;

    -- 2. Loop to create 3000 records
    FOR v_counter IN 1..3000 LOOP
        
        -- Randomly decide Hebrew or English name (50/50)
        v_is_hebrew := (random() > 0.5);

        IF v_is_hebrew THEN
             v_name := v_he_prefixes[1 + floor(random() * array_length(v_he_prefixes, 1))::int] || ' ' ||
                       v_he_suffixes[1 + floor(random() * array_length(v_he_suffixes, 1))::int] || ' ' || 
                       (v_counter)::text; -- Add number to ensure uniqueness
        ELSE
             v_name := v_en_prefixes[1 + floor(random() * array_length(v_en_prefixes, 1))::int] || ' ' ||
                       v_en_suffixes[1 + floor(random() * array_length(v_en_suffixes, 1))::int] || ' ' ||
                       (v_counter)::text;
        END IF;

        -- Random Selection
        v_selected_status := v_status[1 + floor(random() * array_length(v_status, 1))::int];
        v_selected_industry := v_industry[1 + floor(random() * array_length(v_industry, 1))::int];
        v_selected_size := v_size[1 + floor(random() * array_length(v_size, 1))::int];

        v_id := gen_random_uuid();

        -- Insert
        INSERT INTO cards (
            id,
            tenant_id,
            type,
            display_name,
            status,
            custom_fields,
            created_at,
            updated_at,
            hierarchy_path -- REQUIRED
        ) VALUES (
            v_id,
            v_tenant_id,
            'organization',
            v_name,
            v_selected_status,
            jsonb_build_object(
                'industry', v_selected_industry,
                'company_size', v_selected_size,
                'website', 'https://www.example.com',
                'description', 'Auto-generated dummy organization.'
            ),
            now() - (random() * interval '365 days'),
            now() - (random() * interval '30 days'),
            text2ltree(replace(v_id::text, '-', '_')) -- root path is just the ID (ltree format)
        );

    END LOOP;

    RAISE NOTICE 'Successfully seeded 3000 organizations.';
END $$;

COMMIT;
