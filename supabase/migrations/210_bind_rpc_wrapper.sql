
-- Migration: 210_bind_rpc_wrapper.sql
-- Description: Redefined fetch_people_crm to use the fixed underlying logic (get_people_count, fetch_people_data).
-- This applies the fixes from 208/209 to the actual function called by the frontend.

BEGIN;

CREATE OR REPLACE FUNCTION fetch_people_crm(
    arg_tenant_id uuid,
    arg_start integer DEFAULT 0,
    arg_limit integer DEFAULT 100,
    arg_sort_col text DEFAULT 'created_at',
    arg_sort_dir text DEFAULT 'desc',
    arg_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    ret_id uuid,
    ret_name text,
    ret_contact_info jsonb,
    ret_tags text[], 
    ret_status text, 
    ret_rating integer,  
    ret_last_interaction timestamptz,
    ret_updated_at timestamptz,
    ret_role_name text,
    ret_total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_count bigint;
BEGIN
    -- 1. Get exact count using the fixed function (supports ILIKE, correct table)
    v_total_count := get_people_count(arg_tenant_id, arg_filters);

    -- 2. Return data + count
    RETURN QUERY 
    SELECT 
        d.ret_id,
        d.ret_name,
        d.ret_contact_info,
        d.ret_tags,
        d.ret_status,
        d.ret_rating,
        d.ret_last_interaction,
        d.ret_updated_at,
        d.ret_role_name,
        v_total_count as ret_total_count
    FROM fetch_people_data(
        arg_tenant_id, 
        arg_start, 
        arg_limit, 
        arg_sort_col, 
        arg_sort_dir, 
        arg_filters
    ) d;
END;
$$;

-- Grant permissions just in case
GRANT EXECUTE ON FUNCTION fetch_people_crm(uuid, integer, integer, text, text, jsonb) TO authenticated, anon;

COMMIT;
