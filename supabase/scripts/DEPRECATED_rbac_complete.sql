-- ===========================================================================
-- RBAC SYSTEM - COMPLETE MIGRATION
-- ===========================================================================
-- Run this ONCE in Supabase Dashboard SQL Editor
-- ===========================================================================

-- ===========================================================================
-- MIGRATION 1: User Roles Table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' 
    CHECK (role IN ('user', 'admin', 'super_admin')),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manages_roles"
ON public.user_roles FOR ALL TO service_role USING (true);

CREATE POLICY "admins_read_roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON public.user_roles USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role 
ON public.user_roles USING btree (role) 
WHERE role IN ('admin', 'super_admin');

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================================================
-- MIGRATION 2: Custom Access Token Hook
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

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;

-- ===========================================================================
-- MIGRATION 3: Helper Functions
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

-- ===========================================================================
-- MIGRATION 4: Update CPQ RLS Policies
-- ===========================================================================

DO $$ 
DECLARE 
  tbl RECORD;
BEGIN 
  RAISE NOTICE 'Starting CPQ RLS policy update...';
  
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'cpq_%'
    AND table_name NOT IN ('cpq_configured_products', 'cpq_configurations')
    AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);
    
    EXECUTE format('DROP POLICY IF EXISTS "Users can view in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view templates in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_select" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_insert" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_update" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_delete" ON public.%I', tbl.table_name);
    
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
  
  -- Special tables (if they exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cpq_configurations') THEN
    DROP POLICY IF EXISTS "users_own_configs" ON cpq_configurations;
    DROP POLICY IF EXISTS "users_own_configs_or_admin" ON cpq_configurations;
    
    CREATE POLICY "users_own_configs_or_admin" ON cpq_configurations FOR ALL TO authenticated
    USING (user_id = auth.uid() OR (SELECT is_admin()))
    WITH CHECK (user_id = auth.uid() OR (SELECT is_admin()));
    
    RAISE NOTICE '✅ Updated: cpq_configurations';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cpq_configured_products') THEN
    DROP POLICY IF EXISTS "tenant_or_admin_access" ON cpq_configured_products;
    
    CREATE POLICY "tenant_or_admin_access" ON cpq_configured_products FOR ALL TO authenticated
    USING (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()))
    WITH CHECK (tenant_id = (SELECT get_tenant_id_from_jwt()) OR (SELECT is_admin()));
    
    RAISE NOTICE '✅ Updated: cpq_configured_products';
  END IF;
  
  RAISE NOTICE '✅ All CPQ policies updated!';
END $$;

-- ===========================================================================
-- DONE!
-- ===========================================================================

SELECT '✅ RBAC system installed!' as status;
SELECT '📋 Next: Enable Custom Access Token Hook' as next_step;
