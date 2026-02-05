-- Migration: 282_add_updated_at_to_relationships.sql
-- Description: Adds the missing updated_at column to entity_relationships table

BEGIN;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entity_relationships' AND column_name = 'updated_at') THEN
        ALTER TABLE entity_relationships ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

COMMIT;
