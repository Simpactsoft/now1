-- Migration 67: Fix Search History RLS Logic
-- Relax/Fix RLS policies to support both explicit user_id and default auth.uid()

-- 1. Drop existing policies to be safe
drop policy if exists "Users can view their own search history" on search_history;
drop policy if exists "Users can insert their own search history" on search_history;
drop policy if exists "Users can delete their own search history" on search_history;

-- 2. Create Policies (Explicit Logic)
create policy "Users can view their own search history"
  on search_history for select
  using (
    -- Allow if user_id matches auth.uid
    auth.uid() = user_id
  );

create policy "Users can insert their own search history"
  on search_history for insert
  with check (
    -- Allow if user_id matches auth.uid
    auth.uid() = user_id
  );

create policy "Users can delete their own search history"
  on search_history for delete
  using (
    auth.uid() = user_id
  );

-- 3. Grants
grant all on search_history to authenticated;
grant all on search_history to service_role;

-- 4. Reload Schema
NOTIFY pgrst, 'reload schema';
