
-- Migration: 274_grant_relationship_permissions.sql
-- Description: Grants permissions to authenticated users for relationship tables.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.relationship_types TO authenticated;
GRANT ALL ON TABLE public.entity_relationships TO authenticated;
GRANT ALL ON TABLE public.relationship_types TO service_role;
GRANT ALL ON TABLE public.entity_relationships TO service_role;
