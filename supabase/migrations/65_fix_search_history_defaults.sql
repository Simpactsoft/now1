-- Migration 65: Fix Search History Defaults
-- Explicitly enforce the default value for user_id to ensure RLS works
-- This fixes the issue where "if not exists" skipped setting the default on existing broken tables

-- 1. Enforce Default
ALTER TABLE IF EXISTS "public"."search_history"
  ALTER COLUMN "user_id" SET DEFAULT auth.uid();

-- 2. Ensure NOT NULL (users must be logged in)
ALTER TABLE IF EXISTS "public"."search_history"
  ALTER COLUMN "user_id" SET NOT NULL;

-- 3. Ensure Tenant ID is NOT NULL
ALTER TABLE IF EXISTS "public"."search_history"
  ALTER COLUMN "tenant_id" SET NOT NULL;

-- 4. Re-Apply Grants just in case
GRANT ALL ON "public"."search_history" TO authenticated;
GRANT ALL ON "public"."search_history" TO service_role;

-- 5. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
