-- Phase 21: Realistic Tag Seeding (Instant / No Sort)
-- Goal: 93% No Tags, 5% Two Tags, 2% Three Tags.
-- Optimization: Updates arbitrary 2,000 records. No Sorting. No Full Table Scans. Instant execution.

WITH random_parties AS (
    SELECT id 
    FROM parties 
    WHERE type = 'person'
    -- Key Change: No ORDER BY. Just grab the first physical rows found. Blazing fast.
    LIMIT 2000
),
calculated_tags AS (
    SELECT 
        id,
        random() as val
    FROM random_parties
)
UPDATE parties p
SET tags = CASE
    WHEN c.val > 0.98 THEN ARRAY['VIP', 'Urgent', 'Decision Maker'] -- Top 2%
    WHEN c.val > 0.93 THEN ARRAY['New', 'Referral']                -- Next 5%
    ELSE ARRAY[]::text[]                                              -- Remaining 93%
END
FROM calculated_tags c
WHERE p.id = c.id;
