
-- Migration: 273_force_schema_refresh.sql
-- Description: Adds a comment to force PostgREST to reload schema cache.

COMMENT ON TABLE relationship_types IS 'Configurable relationship types for entity links';
