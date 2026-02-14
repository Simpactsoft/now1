-- ===========================================================================
-- RBAC MIGRATION - CONTINUATION
-- ===========================================================================
-- This script checks what already exists and only runs what's missing
-- Safe to run multiple times - idempotent
-- ===========================================================================

-- Check what we have
DO $$
BEGIN
  RAISE NOTICE '🔍 Checking existing RBAC components...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    RAISE NOTICE '✅ user_roles table exists';
  ELSE
    RAISE NOTICE '❌ user_roles table missing';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'custom_access_token_hook') THEN
    RAISE NOTICE '✅ custom_access_token_hook exists';
  ELSE
    RAISE NOTICE '❌ custom_access_token_hook missing';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'is_admin') THEN
    RAISE NOTICE '✅ is_admin() exists';
  ELSE
    RAISE NOTICE '❌ is_admin() missing';
  END IF;
END $$;

-- ===========================================================================
-- MIGRATION 2: Custom Access Token Hook (safe to re-run)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_tenant uuid;
BEGIN
  claims := event->'claims';
  
  SELECT role, tenant_id INTO user_role, user_tenant
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;
  
  IF user_role IS NULL THEN
    user_role := 'user';
  END IF;
  
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;
  
  claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{app_metadata,tenant_id}', 
    CASE WHEN user_tenant IS NOT NULL 
         THEN to_jsonb(user_tenant::text)
         ELSE 'null'::jsonb
    END
  );
  
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant permissions (safe to re-run)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;

SELECT '✅ Custom Access Token Hook created' as status;

-- ===========================================================================
-- MIGRATION 3: Helper Functions (safe to re-run)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'app_role', 'user');
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_id_from_jwt()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_app_role() IN ('admin', 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_tenant_id_from_jwt();
$$;

SELECT '✅ Helper functions created' as status;

-- ===========================================================================
-- MIGRATION 4: Update CPQ RLS Policies
-- ===========================================================================

DO $$ 
DECLARE 
  tbl RECORD;
BEGIN 
  RAISE NOTICE '🔄 Updating CPQ RLS policies...';
  
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'cpq_%'
    AND table_name NOT IN ('cpq_configured_products', 'cpq_configurations')
    AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);
    
    -- Drop old policies
    EXECUTE format('DROP POLICY IF EXISTS "Users can view in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view templates in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_select" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_insert" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_update" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_delete" ON public.%I', tbl.table_name);
    
    -- Create new policies
    EXECUTE format('
      CREATE POLICY "tenant_or_admin_select" ON public.%I FOR SELECT TO authenticated
      USING (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
    ', tbl.table_name);
    
    EXECUTE format('
      CREATE POLICY "tenant_or_admin_insert" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
    ', tbl.table_name);
    
    EXECUTE format('
      CREATE POLICY "tenant_or_admin_update" ON public.%I FOR UPDATE TO authenticated
      USING (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
      WITH CHECK (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
    ', tbl.table_name);
    
    EXECUTE format('
      CREATE POLICY "tenant_or_admin_delete" ON public.%I FOR DELETE TO authenticated
      USING (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
    ', tbl.table_name);
    
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I USING btree (tenant_id)', 
      tbl.table_name, tbl.table_name);
    
    RAISE NOTICE '✅ Updated: %', tbl.table_name;
  END LOOP;
  
  RAISE NOTICE '✅ All CPQ policies updated!';
END $$;

-- ===========================================================================
-- DONE!
-- ===========================================================================

SELECT '✅ RBAC migration complete!' as status;
SELECT 'Next: Enable Custom Access Token Hook in Dashboard' as next_step;
SELECT 'Then: Run the seed script to set admin user' as final_step;
