-- ============================================================================
-- RBAC: Custom Access Token Hook
-- ============================================================================
-- Author: Based on Supabase Official Docs
-- Date: 2026-02-12
--
-- This hook runs BEFORE every JWT issuance and injects user role + tenant_id
-- from the user_roles table into app_metadata claims.
--
-- CRITICAL SECURITY:
-- - Reads from user_roles table (NOT user_metadata which user can modify)
-- - Runs as SECURITY DEFINER (elevated privileges)
-- - Must complete within 2 seconds or token issuance fails
-- - ONLY supabase_auth_admin can execute this
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_tenant uuid;
BEGIN
  -- Extract existing claims
  claims := event->'claims';
  
  -- Fetch role and tenant from secure table
  -- This is the SINGLE SOURCE OF TRUTH for user permissions
  SELECT role, tenant_id 
  INTO user_role, user_tenant
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;
  
  -- Default to 'user' if not found in table
  -- This ensures new users get least-privilege access
  IF user_role IS NULL THEN
    user_role := 'user';
  END IF;
  
  -- Ensure app_metadata exists in claims
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;
  
  -- Inject role into JWT app_metadata
  claims := jsonb_set(
    claims, 
    '{app_metadata,app_role}', 
    to_jsonb(user_role)
  );
  
  -- Inject tenant_id into JWT app_metadata (NULL for admins)
  claims := jsonb_set(
    claims, 
    '{app_metadata,tenant_id}', 
    CASE 
      WHEN user_tenant IS NOT NULL 
      THEN to_jsonb(user_tenant::text)
      ELSE 'null'::jsonb
    END
  );
  
  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ============================================================================
-- CRITICAL PERMISSIONS
-- ============================================================================

-- Grant execution ONLY to supabase_auth_admin (the auth service)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Explicitly REVOKE from all other roles (defense in depth)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Allow auth hook to read from user_roles table
GRANT SELECT ON public.user_roles TO supabase_auth_admin;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.custom_access_token_hook IS 
'Auth Hook: Injects app_role and tenant_id into JWT claims from user_roles table. 
This hook is called BEFORE every JWT issuance.
SECURITY: Uses app_metadata (server-only) NOT user_metadata (user-editable).
MUST complete within 2 seconds.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this after enabling the hook to verify it works:
/*
SELECT 
  email,
  raw_app_meta_data->>'app_role' as role_in_jwt,
  (SELECT role FROM user_roles WHERE user_id = auth.users.id) as role_in_table
FROM auth.users
LIMIT 5;
*/
