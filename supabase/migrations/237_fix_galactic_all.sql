
-- Migration: 237_fix_galactic_all.sql
-- Description: One-shot fix for Galactic Tenant: Upgrades role and seeds data.

BEGIN;

DO $$
DECLARE
    v_tenant_id uuid := '00000000-0000-0000-0000-000000000003'; -- Galactic Stress Test
    v_user_email text := 'sales@impactsoft.co.il';
    v_user_id uuid;
    v_counter integer := 0;
    
    -- Random Arrays
    v_status text[] := ARRAY['ACTIVE', 'PROSPECT', 'PARTNER', 'CHURNED', 'ACTIVE', 'ACTIVE'];
    v_industry text[] := ARRAY['TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'RETAIL', 'REAL_ESTATE', 'MANUFACTURING', 'SERVICES'];
    v_size text[] := ARRAY['1_10', '11_50', '51_200', '201_500', '500_PLUS'];
    
     -- Name Parts
    v_en_prefixes text[] := ARRAY['Tech', 'Global', 'Next', 'Smart', 'Green', 'Future', 'Alpha', 'Omega', 'Prime', 'Dynamic'];
    v_en_suffixes text[] := ARRAY['Corp', 'Inc', 'Solutions', 'Systems', 'Ltd', 'Group', 'Industries', 'Holdings', 'Ventures'];
    
    v_he_prefixes text[] := ARRAY['חברת', 'קבוצת', 'מערכות', 'פתרונות', 'טכנולוגיות', 'אדיר', 'פסגות', 'נתיבי', 'אלפא'];
    v_he_suffixes text[] := ARRAY['בע״מ', 'החדשה', 'מתקדמות', 'ישראל', 'הצפון', 'הדרום', 'אינטרנשיונל', 'החזקות'];

    v_id uuid;
    v_name text;
    v_selected_status text;
    v_selected_industry text;
    v_selected_size text;
    v_is_hebrew boolean;

BEGIN
    -- 1. FIX PERMISSIONS
    RAISE NOTICE '--- Fixing Permissions ---';
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    -- Update role to system_admin
    UPDATE tenant_members 
    SET role = 'system_admin' 
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO tenant_members (tenant_id, user_id, role)
        VALUES (v_tenant_id, v_user_id, 'system_admin');
        RAISE NOTICE 'Inserted new membership.';
    ELSE
        RAISE NOTICE 'Upgraded existing membership to system_admin.';
    END IF;

    -- 2. SEED DATA
    RAISE NOTICE '--- Seeding Data ---';
    -- Check if already seeded to avoid duplicates (optional, but good practice. User asked for data, so we add).
    -- Actually, user said it's empty, so we just loop.
    
    FOR v_counter IN 1..3000 LOOP
        v_is_hebrew := (random() > 0.5);

        IF v_is_hebrew THEN
             v_name := v_he_prefixes[1 + floor(random() * array_length(v_he_prefixes, 1))::int] || ' ' ||
                       v_he_suffixes[1 + floor(random() * array_length(v_he_suffixes, 1))::int] || ' ' || 
                       (v_counter)::text; 
        ELSE
             v_name := v_en_prefixes[1 + floor(random() * array_length(v_en_prefixes, 1))::int] || ' ' ||
                       v_en_suffixes[1 + floor(random() * array_length(v_en_suffixes, 1))::int] || ' ' ||
                       (v_counter)::text;
        END IF;

        v_selected_status := v_status[1 + floor(random() * array_length(v_status, 1))::int];
        v_selected_industry := v_industry[1 + floor(random() * array_length(v_industry, 1))::int];
        v_selected_size := v_size[1 + floor(random() * array_length(v_size, 1))::int];
        v_id := gen_random_uuid();

        INSERT INTO cards (id, tenant_id, type, display_name, status, custom_fields, created_at, updated_at, hierarchy_path) 
        VALUES (
            v_id, v_tenant_id, 'organization', v_name, v_selected_status,
            jsonb_build_object('industry', v_selected_industry, 'company_size', v_selected_size, 'website', 'https://www.example.com', 'description', 'Galactic Seed'),
            now() - (random() * interval '365 days'),
            now() - (random() * interval '30 days'),
            text2ltree(replace(v_id::text, '-', '_'))
        );
    END LOOP;

    RAISE NOTICE 'Successfully fixed permissions and seeded 3000 organizations.';
END $$;

COMMIT;
