-- Migration: 81_add_custom_fields_to_people.sql
-- Description: Adds the missing 'custom_fields' JSONB column to the 'people' table.
-- This is critical for storing dynamic attributes like 'status'.

ALTER TABLE people
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Optimize access if we query by custom keys often
CREATE INDEX IF NOT EXISTS idx_people_custom_fields ON people USING GIN (custom_fields);

NOTIFY pgrst, 'reload schema';
