
-- Migration: 156_simple_counts.sql
-- Description: Absolute basic check. How many rows are in the tables?
-- If this returns 0 for cards, we lost the data and need to re-seed.

SELECT 'profiles' as section, count(*) as row_count FROM profiles
UNION ALL
SELECT 'cards' as section, count(*) as row_count FROM cards;
