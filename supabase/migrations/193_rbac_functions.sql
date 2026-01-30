
-- Migration: 193_rbac_functions.sql
-- Description: Helper functions to check permissions inside RLS.

-- 1. Helper to get current role (safe/fast from JWT)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Try to get role from app_metadata (set by custom claims or login trigger)
  jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  
  -- Fallback: If not in JWT, query table (Slower but reliable)
  IF jwt_role IS NULL THEN
     SELECT role::text INTO jwt_role
     FROM public.profiles
     WHERE id = auth.uid();
  END IF;

  RETURN jwt_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 2. Main Gatekeeper Function
CREATE OR REPLACE FUNCTION public.has_permission(requested_permission text)
RETURNS boolean AS $$
DECLARE
  user_role_val public.app_role;
BEGIN
  -- 1. Get Role
  user_role_val := public.user_role()::public.app_role;

  -- 2. Check Role Permissions table
  -- Optimization: Distributor is God Mode (optional optimization, but let's stick to table)
  IF user_role_val = 'distributor' THEN
     RETURN TRUE; -- Fast pass for Admin
  END IF;

  -- 3. Check Table
  PERFORM 1 
  FROM public.role_permissions
  WHERE role = user_role_val
    AND permission = requested_permission;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
