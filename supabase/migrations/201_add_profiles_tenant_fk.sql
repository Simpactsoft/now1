
-- Migration: 201_add_profiles_tenant_fk.sql
-- Description: Adds Explicit Foreign Key from profiles.tenant_id to tenants.id to enable PostgREST embedding.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_tenant_id_fkey'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_tenant_id_fkey
        FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id)
        ON DELETE SET NULL;
    END IF;
END $$;
