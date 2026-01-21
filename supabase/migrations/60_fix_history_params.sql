-- Migration 60: Ensure Search History Access
-- Re-runnable migration to fix potential RLS or missing table issues relative to Search History

-- 1. Ensure table exists (idempotent)
create table if not exists search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  tenant_id uuid references tenants(id) not null,
  term text not null,
  created_at timestamptz default now()
);

-- 2. Ensure Index
create index if not exists idx_search_history_user_recent 
  on search_history(user_id, tenant_id, created_at desc);

-- 3. Reset RLS (Safety first: Drop old policies if they exist to avoid duplication errors)
alter table search_history enable row level security;

do $$ 
begin
  if exists (select 1 from pg_policies where policyname = 'Users can view their own search history') then
    drop policy "Users can view their own search history" on search_history;
  end if;
  if exists (select 1 from pg_policies where policyname = 'Users can insert their own search history') then
    drop policy "Users can insert their own search history" on search_history;
  end if;
  if exists (select 1 from pg_policies where policyname = 'Users can delete their own search history') then
    drop policy "Users can delete their own search history" on search_history;
  end if;
end $$;

-- 4. Re-create Policies
create policy "Users can view their own search history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own search history"
  on search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own search history"
  on search_history for delete
  using (auth.uid() = user_id);

-- 5. Grants
grant all on search_history to authenticated;
grant all on search_history to service_role;
