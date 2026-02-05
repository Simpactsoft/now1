-- Cleanup script to remove all relationship data and types (for development reset)

-- 1. Truncate the relationships table (CASCADE to handle any dependent rows if they exist)
TRUNCATE TABLE entity_relationships CASCADE;

-- 2. Optional: Remove all dynamic relationship types (RPCs will recreate them)
-- DELETE FROM relationship_types; 

-- Note: If you want to keep the types (schema), keep line 5 commented out.
-- If you want a full reset including types (names), uncomment line 5.
