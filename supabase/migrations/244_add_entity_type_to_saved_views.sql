-- Migration 244: Add entity_type column to saved_views
-- Purpose: Scope saved views by entity type so People views don't bleed into Organizations and vice versa.

-- 1. Add the entity_type column (nullable initially for backward compat)
ALTER TABLE saved_views
ADD COLUMN IF NOT EXISTS entity_type text;

-- 2. Backfill existing views: assume all existing views are for 'people' 
--    since that was the first/primary entity view created.
UPDATE saved_views SET entity_type = 'people' WHERE entity_type IS NULL;

-- 3. Make it NOT NULL after backfill
ALTER TABLE saved_views ALTER COLUMN entity_type SET NOT NULL;

-- 4. Drop old unique constraint (tenant_id, name)
ALTER TABLE saved_views DROP CONSTRAINT IF EXISTS uq_saved_views_name_tenant;

-- 5. Create new unique constraint scoped by entity_type
ALTER TABLE saved_views 
ADD CONSTRAINT uq_saved_views_name_tenant_entity UNIQUE (tenant_id, entity_type, name);

-- 6. Add index for fast lookup
CREATE INDEX IF NOT EXISTS idx_saved_views_entity ON saved_views(tenant_id, entity_type);
