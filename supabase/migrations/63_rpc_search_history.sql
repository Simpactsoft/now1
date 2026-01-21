-- Migration 63: RPC Search History
-- Bypass RLS using Security Definer functions for robust access

-- 1. ADD Search History
create or replace function add_search_history(
    p_tenant_id uuid,
    p_term text
)
returns boolean
language plpgsql
security definer -- Bypass RLS
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    -- Silent fail if no user (prevents UI errors for anon users)
    if v_user_id is null then
        return false;
    end if;

    if p_term is null or length(trim(p_term)) = 0 then
        return false;
    end if;

    -- Delete existing exact match for this user/tenant to "bump" it
    delete from search_history 
    where tenant_id = p_tenant_id 
      and user_id = v_user_id 
      and term = p_term;

    -- Insert new
    insert into search_history (tenant_id, user_id, term)
    values (p_tenant_id, v_user_id, p_term);

    return true;
exception when others then
    -- Log error but return false to prevent crash
    raise warning 'Error in add_search_history: %', SQLERRM;
    return false;
end;
$$;

-- 2. GET Search History
create or replace function get_search_history(
    p_tenant_id uuid
)
returns table (
    term text,
    created_at timestamptz
)
language plpgsql
security definer -- Bypass RLS
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        return; -- Return empty set
    end if;

    return query
    select distinct on (sh.term) sh.term, sh.created_at
    from search_history sh
    where sh.tenant_id = p_tenant_id
      and sh.user_id = v_user_id
    order by sh.term, sh.created_at desc
    limit 100;
end;
$$;

-- 3. CLEAR Search History
create or replace function clear_search_history(
    p_tenant_id uuid
)
returns boolean
language plpgsql
security definer -- Bypass RLS
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        return false;
    end if;

    delete from search_history 
    where tenant_id = p_tenant_id 
      and user_id = v_user_id;

    return true;
exception when others then
    raise warning 'Error in clear_search_history: %', SQLERRM;
    return false;
end;
$$;


-- Grants
grant execute on function add_search_history(uuid, text) to authenticated;
grant execute on function add_search_history(uuid, text) to service_role;
grant execute on function add_search_history(uuid, text) to anon;

grant execute on function get_search_history(uuid) to authenticated;
grant execute on function get_search_history(uuid) to service_role;
grant execute on function get_search_history(uuid) to anon;

grant execute on function clear_search_history(uuid) to authenticated;
grant execute on function clear_search_history(uuid) to service_role;
grant execute on function clear_search_history(uuid) to anon;

-- Force Schema Refresh
NOTIFY pgrst, 'reload schema';
