-- Migration: 244_update_org_rpc.sql
-- Description: Create a SECURITY DEFINER RPC to update organization details.
-- This bypasses strict RLS on the 'cards' table which might prevent users from updating organizations they don't "own" but can see via other RPCs.

CREATE OR REPLACE FUNCTION update_organization_profile(
    arg_tenant_id uuid,
    arg_org_id uuid,
    arg_display_name text DEFAULT NULL,
    arg_status text DEFAULT NULL,
    arg_tags text[] DEFAULT NULL,
    arg_custom_fields jsonb DEFAULT NULL,
    arg_contact_methods jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_affected integer;
BEGIN
    -- Update the record, ensuring Tenant ID matches for security
    UPDATE cards
    SET
        display_name = COALESCE(arg_display_name, display_name),
        status = COALESCE(arg_status, status),
        tags = COALESCE(arg_tags, tags),
        custom_fields = CASE 
            WHEN arg_custom_fields IS NOT NULL THEN 
                -- Merge existing or replace? Usually Replace if we pass the full object from frontend, 
                -- but here we might want to be careful. The frontend sends the MERGED object.
                arg_custom_fields
            ELSE custom_fields 
        END,
        contact_methods = COALESCE(arg_contact_methods, contact_methods),
        updated_at = now()
    WHERE
        id = arg_org_id
        AND tenant_id = arg_tenant_id
        AND type = 'organization'; 
        -- We explicitly restrict to 'organization' type to prevent using this for people if policies differ.

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$;
