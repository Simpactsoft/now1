-- Create search_history table
create table if not exists search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  tenant_id uuid references tenants(id) not null,
  term text not null,
  created_at timestamptz default now()
);

-- Index for fast retrieval by user and recency
create index if not exists idx_search_history_user_recent 
  on search_history(user_id, tenant_id, created_at desc);

-- RLS Policies
alter table search_history enable row level security;

create policy "Users can view their own search history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert their own search history"
  on search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own search history"
  on search_history for delete
  using (auth.uid() = user_id);

-- Grants
grant all on search_history to authenticated;
grant all on search_history to service_role;
