-- Migration 70: Allow NULL user_id in search_history table
-- Reason: To support the "Relaxed/Guest" search history mode we implemented in the RPCs.
-- The previous migration relaxed the function logic, but the table schema still enforced strict NOT NULL.

ALTER TABLE search_history
ALTER COLUMN user_id DROP NOT NULL;

-- Also ensure the default is still auth.uid() just in case, but it's optional now.
ALTER TABLE search_history
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
