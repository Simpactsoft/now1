
-- Migration: 194_inspect_cards_policies.sql
-- Description: Check current RLS on cards to know what to update.

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'cards';
