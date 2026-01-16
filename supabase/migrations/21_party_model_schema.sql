-- Phase 10: The Party Model (Core Infrastructure)
-- This migration implements a Supertype/Subtype (Joined Inheritance) pattern.

-- 1. Enums and Extensions
DO $$ BEGIN
    CREATE TYPE party_type AS ENUM ('person', 'organization', 'bot');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Supertype table: parties
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Keep multi-tenancy at the core
    type party_type NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    contact_methods JSONB DEFAULT '[]'::jsonb,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Index for deep JSONB path operations
CREATE INDEX IF NOT EXISTS idx_parties_contact_methods_path_ops ON parties USING GIN (contact_methods jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_parties_tenant_id ON parties(tenant_id);

-- 3. Subtype table: people
CREATE TABLE IF NOT EXISTS people (
    party_id UUID PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    dob DATE, -- Date of Birth (supports partial dates via application logic or nullable day/month)
    gender TEXT
);

-- 4. Subtype table: organizations
CREATE TABLE IF NOT EXISTS organizations_ext ( -- renamed to avoid conflict with potential existing tables
    party_id UUID PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
    tax_id TEXT,
    company_size TEXT,
    industry TEXT
);

-- 5. Membership / Role Table (The "Employee" link)
-- This links a person (subtype) to an organization (subtype)
CREATE TABLE IF NOT EXISTS party_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    person_id UUID NOT NULL REFERENCES people(party_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE, -- party_id of an organization
    role_name TEXT NOT NULL, -- e.g., 'Employee', 'Manager', 'Consultant'
    salary INTEGER DEFAULT 0,
    org_path ltree,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_party_memberships_tenant_id ON party_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_party_memberships_org_path_gist ON party_memberships USING GIST (org_path);

-- 6. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_parties_updated_at ON parties;
CREATE TRIGGER trg_parties_updated_at
    BEFORE UPDATE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();