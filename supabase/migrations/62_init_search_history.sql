-- Migration 62: Init Search History (Final)
-- Ensure table exists regardless of previous failures

-- 1. Create table
create table if not exists search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  tenant_id uuid references tenants(id) not null,
  term text not null,
  created_at timestamptz default now()
);

-- 2. Index
create index if not exists idx_search_history_user_recent 
  on search_history(user_id, tenant_id, created_at desc);

-- 3. RLS
alter table search_history enable row level security;

-- Drop old policies to be safe
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

-- Create Policies
create policy "Users can view their own search history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own search history"
  on search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own search history"
  on search_history for delete
  using (auth.uid() = user_id);

-- 4. Grants
grant all on search_history to authenticated;
grant all on search_history to service_role;

-- 5. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
