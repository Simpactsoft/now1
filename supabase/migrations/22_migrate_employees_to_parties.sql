-- Phase 10: Chunked Background Migration (Employees -> Parties)
-- שימוש בלולאה עם Chunking כדי למנוע Upstream Timeout בדפדפן.

DO $$
DECLARE
    batch_size INT := 100000;
    processed_count INT := 0;
    total_to_process INT;
BEGIN
    ---------------------------------------------------------
    -- 0. הקמת הארגון (אם לא קיים)
    ---------------------------------------------------------
    INSERT INTO parties (id, tenant_id, type, display_name)
    VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'organization', 'Legacy Data HQ')
    ON CONFLICT (id) DO NOTHING;

    ---------------------------------------------------------
    -- 1. הגירת Parties (זהויות)
    ---------------------------------------------------------
    LOOP
        INSERT INTO parties (id, tenant_id, type, display_name, created_at)
        SELECT id, tenant_id, 'person'::party_type, name, created_at
        FROM employees
        WHERE id NOT IN (SELECT id FROM parties)
        LIMIT batch_size
        ON CONFLICT (id) DO NOTHING;
        
        GET DIAGNOSTICS processed_count = ROW_COUNT;
        EXIT WHEN processed_count = 0;
        
        RAISE NOTICE 'Migrated % parties...', (SELECT count(*) FROM parties);
        COMMIT; -- שמירת השינויים בבלוקים
    END LOOP;

    ---------------------------------------------------------
    -- 2. הגירת People (נתונים אישיים)
    ---------------------------------------------------------
    LOOP
        INSERT INTO people (party_id, first_name, last_name)
        SELECT 
            id,
            split_part(name, ' ', 1) as first_name,
            substring(name FROM position(' ' IN name) + 1) as last_name
        FROM employees
        WHERE id NOT IN (SELECT party_id FROM people)
        LIMIT batch_size
        ON CONFLICT (party_id) DO NOTHING;
        
        GET DIAGNOSTICS processed_count = ROW_COUNT;
        EXIT WHEN processed_count = 0;
        
        RAISE NOTICE 'Migrated % people records...', (SELECT count(*) FROM people);
        COMMIT;
    END LOOP;

    ---------------------------------------------------------
    -- 3. הגירת Memberships (תפקידים)
    ---------------------------------------------------------
    LOOP
        INSERT INTO party_memberships (tenant_id, person_id, organization_id, role_name, salary, org_path, created_at)
        SELECT 
            tenant_id,
            id as person_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            'Employee',
            salary,
            org_path,
            created_at
        FROM employees
        WHERE id NOT IN (SELECT person_id FROM party_memberships)
        LIMIT batch_size
        ON CONFLICT DO NOTHING;
        
        GET DIAGNOSTICS processed_count = ROW_COUNT;
        EXIT WHEN processed_count = 0;
        
        RAISE NOTICE 'Migrated % membership records...', (SELECT count(*) FROM party_memberships);
        COMMIT;
    END LOOP;

END $$;
