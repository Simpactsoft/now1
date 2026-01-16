-- Migration 04: Security Claims Implementation
-- Task: Implement set_claim for RBAC in auth.users

CREATE OR REPLACE FUNCTION set_claim(uid uuid, claim text, value jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Logic: Update the raw_app_meta_data column in auth.users
  -- We use jsonb_set to update or insert the specific claim
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(claim, value)
  WHERE id = uid;
  
  RETURN 'OK';
END;
$$;

-- Security: Revoke execute from public and anon
REVOKE EXECUTE ON FUNCTION set_claim(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_claim(uuid, text, jsonb) FROM anon;

-- Only service_role should execute this
GRANT EXECUTE ON FUNCTION set_claim(uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION set_claim IS 'Sets a custom claim in the users raw_app_meta_data. Restricted to service_role.';
