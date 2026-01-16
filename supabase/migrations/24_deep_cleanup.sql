-- Phase 10: High-Frequency Chunked Deep Cleanup (v4 - Final Fix)
-- Optimized with better indexing and fixed PostgreSQL syntax for chunked deletion.

-- 1. Create indexes to speed up the lookup for deletions
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type);
CREATE INDEX IF NOT EXISTS idx_party_memberships_person_id ON party_memberships(person_id);

DO $$
DECLARE
    batch_size INT := 50000;
    processed_count INT;
BEGIN
    RAISE NOTICE 'Starting cleanup of legacy identities...';

    -- A. מחיקת זהויות ללא תפקיד (המידע הישן)
    LOOP
        DELETE FROM parties
        WHERE id IN (
            SELECT p.id
            FROM parties p
            WHERE p.type = 'person'
            AND NOT EXISTS (SELECT 1 FROM party_memberships m WHERE m.person_id = p.id)
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS processed_count = ROW_COUNT;
        EXIT WHEN processed_count = 0;
        
        COMMIT;
        RAISE NOTICE 'Deleted % legacy identities...', processed_count;
    END LOOP;

    -- B. מחיקת רשומות 'O_' (שרידים מה-Stress Test הישן)
    LOOP
        DELETE FROM parties
        WHERE id IN (
            SELECT id 
            FROM parties 
            WHERE display_name LIKE 'O_%' 
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS processed_count = ROW_COUNT;
        EXIT WHEN processed_count = 0;
        
        COMMIT;
        RAISE NOTICE 'Deleted % O_prefixed records...', processed_count;
    END LOOP;

    -- C. מחיקת הטבלה הישנה והמיותרת
    DROP TABLE IF EXISTS employees CASCADE;

    RAISE NOTICE 'Cleanup complete.';
END $$;
