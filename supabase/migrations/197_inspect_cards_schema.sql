
-- Migration: 197_inspect_cards_schema.sql
-- Description: Check what columns ACTUALLY exist in cards table.

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'cards'
ORDER BY ordinal_position;
