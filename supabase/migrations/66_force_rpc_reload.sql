-- Migration 66: Force RPC Reload
-- Explicitly drop and recreate functions to fix schema cache issues

-- 1. Drop existing functions to be clean
drop function if exists submit_search_history(uuid, text);
drop function if exists list_search_history(uuid);
drop function if exists wipe_search_history(uuid);

-- 2. Re-Create submit_search_history
create or replace function submit_search_history(
    p_tenant_id uuid,
    p_term text
)
returns boolean
language plpgsql
security definer
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        return false;
    end if;

    if p_term is null or length(trim(p_term)) = 0 then
        return false;
    end if;

    -- Delete dupes
    delete from search_history 
    where tenant_id = p_tenant_id 
      and user_id = v_user_id 
      and term = p_term;

    -- Insert new
    insert into search_history (tenant_id, user_id, term)
    values (p_tenant_id, v_user_id, p_term);

    return true;
exception when others then
    return false;
end;
$$;

-- 3. Re-Create list_search_history
create or replace function list_search_history(
    p_tenant_id uuid
)
returns table (
    term text,
    created_at timestamptz
)
language plpgsql
security definer
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        return;
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

-- 4. Re-Create wipe_search_history
create or replace function wipe_search_history(
    p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
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
    return false;
end;
$$;

-- 5. Grants
grant execute on function submit_search_history(uuid, text) to authenticated;
grant execute on function submit_search_history(uuid, text) to service_role;
grant execute on function submit_search_history(uuid, text) to anon;

grant execute on function list_search_history(uuid) to authenticated;
grant execute on function list_search_history(uuid) to service_role;
grant execute on function list_search_history(uuid) to anon;

grant execute on function wipe_search_history(uuid) to authenticated;
grant execute on function wipe_search_history(uuid) to service_role;
grant execute on function wipe_search_history(uuid) to anon;

-- 6. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
