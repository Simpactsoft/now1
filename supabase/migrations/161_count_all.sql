
-- Migration: 161_count_all.sql
-- Description: Counts records in all key tables (Active and Legacy).

SELECT 'ACTIVE: cards (New)' as table_name, count(*) as count FROM cards
UNION ALL
SELECT 'ACTIVE: profiles (Users)', count(*) FROM profiles
UNION ALL
SELECT 'LEGACY: people (Archived)', count(*) FROM people
UNION ALL
SELECT 'LEGACY: organizations', count(*) FROM organizations;
