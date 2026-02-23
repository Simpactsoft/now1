-- Fix the RLS Policy for activity_stream table
-- The original policy had an incorrect column or table mapping (auth.users instead of public.profiles, org_id instead of tenant_id)

DROP POLICY IF EXISTS "Users can only see their organization's events" ON public.activity_stream;

CREATE POLICY "Users can only see their organization's events"
ON public.activity_stream
FOR SELECT
USING (
  -- 1. Try to get tenant_id from the session JWT (app_metadata or user_metadata)
  organization_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  OR 
  organization_id = (SELECT auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  OR
  -- 2. Fallback to checking the public.profiles table
  organization_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  )
);
