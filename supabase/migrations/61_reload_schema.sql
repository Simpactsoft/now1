-- Migration 61: Force Schema Cache Reload
-- Triggers a reload of the PostgREST schema cache to recognize the new search_history table.

NOTIFY pgrst, 'reload schema';

-- Also add a comment to ensure a schema change event is fired
COMMENT ON TABLE search_history IS 'User search history for autocomplete';
