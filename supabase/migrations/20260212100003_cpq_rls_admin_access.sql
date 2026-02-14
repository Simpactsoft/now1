-- ============================================================================
-- RBAC: Update CPQ RLS Policies for Admin Access
-- ============================================================================
-- Author: Based on Architect Research + Supabase Best Practices
-- Date: 2026-02-12
--
-- This migration automatically updates ALL CPQ tables to allow:
-- 1. Regular users: access only their tenant
-- 2. Admin users: access ALL tenants
--
-- Performance optimization: Wraps helper functions in SELECT for caching
-- ============================================================================

DO $$ 
DECLARE 
  tbl RECORD;
BEGIN 
  RAISE NOTICE 'Starting CPQ RLS policy update with admin access...';
  
  -- Loop through all CPQ tables (except special ones)
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'cpq_%'
    AND table_name NOT IN ('cpq_configured_products', 'cpq_configurations')
    AND table_type = 'BASE TABLE'
  LOOP 
    RAISE NOTICE 'Processing table: %', tbl.table_name;
    
    -- Ensure RLS is enabled
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);
    
    -- Drop old policies (safe - uses IF EXISTS)
    EXECUTE format('DROP POLICY IF EXISTS "Users can view in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can view templates in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage in their tenant" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_select" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_insert" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_update" ON public.%I', tbl.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_or_admin_delete" ON public.%I', tbl.table_name);
    
    -- CREATE new SELECT policy
    -- Uses (SELECT ...) pattern for performance caching
    EXECUTE format($policy$
      CREATE POLICY "tenant_or_admin_select"
      ON public.%I FOR SELECT
      TO authenticated
      USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
      )
    $policy$, tbl.table_name);
    
    -- CREATE new INSERT policy
    EXECUTE format($policy$
      CREATE POLICY "tenant_or_admin_insert"
      ON public.%I FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
      )
    $policy$, tbl.table_name);
    
    -- CREATE new UPDATE policy
    EXECUTE format($policy$
      CREATE POLICY "tenant_or_admin_update"
      ON public.%I FOR UPDATE
      TO authenticated
      USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
      )
      WITH CHECK (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
      )
    $policy$, tbl.table_name);
    
    -- CREATE new DELETE policy
    EXECUTE format($policy$
      CREATE POLICY "tenant_or_admin_delete"
      ON public.%I FOR DELETE
      TO authenticated
      USING (
        tenant_id = (SELECT get_tenant_id_from_jwt())
        OR (SELECT is_admin())
      )
    $policy$, tbl.table_name);
    
    -- ⚡ CRITICAL: Create tenant_id index for RLS performance
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I USING btree (tenant_id)',
      tbl.table_name, tbl.table_name
    );
    
    RAISE NOTICE '✅ Updated policies and index for: %', tbl.table_name;
  END LOOP;
  
  -- ============================================================================
  -- Special handling for user-specific tables
  -- ============================================================================
  
  -- cpq_configurations: owned by user OR admin can see all
  DROP POLICY IF EXISTS "users_own_configs" ON cpq_configurations;
  DROP POLICY IF EXISTS "users_own_configs_or_admin" ON cpq_configurations;
  
  CREATE POLICY "users_own_configs_or_admin"
  ON cpq_configurations FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT is_admin())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (SELECT is_admin())
  );
  
  RAISE NOTICE '✅ Updated cpq_configurations policy';
  
  -- cpq_configured_products: tenant-based OR admin
  DROP POLICY IF EXISTS "tenant_or_admin_access" ON cpq_configured_products;
  
  CREATE POLICY "tenant_or_admin_access"
  ON cpq_configured_products FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT get_tenant_id_from_jwt())
    OR (SELECT is_admin())
  )
  WITH CHECK (
    tenant_id = (SELECT get_tenant_id_from_jwt())
    OR (SELECT is_admin())
  );
  
  RAISE NOTICE '✅ Updated cpq_configured_products policy';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All CPQ RLS policies updated successfully!';
  RAISE NOTICE 'Admin users can now access ALL tenants.';
  RAISE NOTICE 'Regular users still restricted to their tenant.';
  RAISE NOTICE '========================================';
END $$;
