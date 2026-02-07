BEGIN;

DROP TRIGGER IF EXISTS trg_maintain_profile_path ON profiles;
DROP TRIGGER IF EXISTS maintain_profile_path ON profiles;
DROP FUNCTION IF EXISTS maintain_profile_path() CASCADE;

CREATE OR REPLACE FUNCTION maintain_profile_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_parent_path ltree;
    old_full_path ltree;
BEGIN
    IF TG_OP = 'INSERT' OR (NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
        IF NEW.parent_id IS NULL THEN
            new_parent_path = 'root'::ltree;
        ELSE
            SELECT org_path INTO new_parent_path
            FROM profiles
            WHERE id = NEW.parent_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Parent profile % not found', NEW.parent_id;
            END IF;
        END IF;
        
        NEW.org_path = new_parent_path || text2ltree(replace(NEW.id::text, '-', '_'));
        
        IF TG_OP = 'UPDATE' AND OLD.org_path IS DISTINCT FROM NEW.org_path THEN
            old_full_path := OLD.org_path;
            
            UPDATE profiles
            SET org_path = NEW.org_path || subpath(org_path, nlevel(old_full_path))
            WHERE org_path <@ old_full_path
              AND id != NEW.id;
            
            RAISE NOTICE 'Updated % descendant profiles', 
                        (SELECT COUNT(*) FROM profiles WHERE org_path <@ NEW.org_path AND id != NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER maintain_profile_path
    BEFORE INSERT OR UPDATE OF parent_id ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION maintain_profile_path();

DO $$
DECLARE
    profile_record RECORD;
    fixed_count INTEGER := 0;
BEGIN
    FOR profile_record IN
        SELECT id, parent_id FROM profiles ORDER BY nlevel(org_path), org_path
    LOOP
        UPDATE profiles SET parent_id = profile_record.parent_id WHERE id = profile_record.id;
        fixed_count := fixed_count + 1;
    END LOOP;
    RAISE NOTICE 'Validated % profiles', fixed_count;
END;
$$;

CREATE OR REPLACE FUNCTION validate_hierarchy()
RETURNS TABLE(profile_id UUID, current_path ltree, expected_path ltree, status TEXT)
LANGUAGE sql STABLE
AS $$
    WITH RECURSIVE expected_paths AS (
        SELECT id, org_path, ('root.' || replace(id::text, '-', '_'))::ltree as expected
        FROM profiles WHERE parent_id IS NULL
        UNION ALL
        SELECT p.id, p.org_path, (ep.expected || replace(p.id::text, '-', '_'))::ltree
        FROM profiles p
        INNER JOIN expected_paths ep ON p.parent_id = ep.id
    )
    SELECT id, org_path, expected, 
           CASE WHEN org_path = expected THEN '✅ Valid' ELSE '❌ Mismatch' END
    FROM expected_paths WHERE org_path != expected;
$$;

COMMIT;


