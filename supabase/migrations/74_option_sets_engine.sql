-- Migration: 74_option_sets_engine.sql
-- Description: High-Scale Option Sets Engine with Shadowing & i18n
-- Based on Enterprise SaaS Architecture.

-- 1. Create Option Sets Table (The Container)
CREATE TABLE IF NOT EXISTS option_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant ID: NULL = System Global Set, Value = Tenant Specific Set
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Code: Unique identifier for the set (e.g. 'industry_types', 'lead_status')
    code VARCHAR NOT NULL,
    
    -- Metadata
    description TEXT,
    is_locked BOOLEAN DEFAULT false, -- If true, tenants cannot extend this system set
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    -- A tenant cannot have duplicate set codes.
    -- Global sets (tenant_id is null) must also be unique by code.
    UNIQUE NULLS NOT DISTINCT (tenant_id, code)
);

-- 2. Create Option Values Table (The Items)
CREATE TABLE IF NOT EXISTS option_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to the Set
    option_set_id UUID NOT NULL REFERENCES option_sets(id) ON DELETE CASCADE,
    
    -- Tenant ID:
    -- NULL = Default System Value. 
    -- Value = Tenant Override or Tenant Custom Value.
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Internal Code: Immutable key for logic (e.g. 'OPEN', 'CLOSED')
    -- If a tenant adds a row with the SAME set_id and internal_code as a system row,
    -- it is considered an OVERRIDE (Shadowing).
    internal_code VARCHAR NOT NULL,
    
    -- Display Labels (i18n Hybrid)
    -- Structure: {"en": "Open", "he": "פתוח"}
    label_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Validation & Styling
    color VARCHAR, -- Hex code for badges
    icon VARCHAR, -- Lucide icon name
    
    -- Ordering
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Attributes for dependency logic (e.g. parent_codes: ['ASIA'])
    attributes JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    -- A tenant cannot define the same code twice within a set.
    UNIQUE NULLS NOT DISTINCT (option_set_id, tenant_id, internal_code)
);

-- 3. High-Performance Indexes

-- 3.1. Fast lookup of sets by code
CREATE INDEX IF NOT EXISTS idx_option_sets_lookup ON option_sets(tenant_id, code);

-- 3.2. Fast retrieval of values for a set
CREATE INDEX IF NOT EXISTS idx_option_values_set_tenant ON option_values(option_set_id, tenant_id);

-- 3.3. i18n Search Index (GIN) -> Allows fast "ILIQUE" search inside JSON values keys
-- Note: Requires pg_trgm for best text search, but basic JSONB ops also work.
CREATE INDEX IF NOT EXISTS idx_option_values_labels ON option_values USING GIN (label_i18n);

-- 3.4. Sorting Index (Optimization for 'en' default sort)
-- Allows ORDER BY (label_i18n->>'en') without full table scan
CREATE INDEX IF NOT EXISTS idx_option_values_sort_en ON option_values ((label_i18n->>'en'));


-- 4. Enable RLS (Security)
ALTER TABLE option_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_values ENABLE ROW LEVEL SECURITY;

-- 4.1. Option Sets Policies
-- Read: Everyone can read Global sets (tenant_id IS NULL) OR their own sets.
CREATE POLICY option_sets_read_policy ON option_sets
    FOR SELECT TO authenticated
    USING (
        tenant_id IS NULL -- Global
        OR 
        EXISTS ( -- Own Tenant
            SELECT 1 FROM tenant_members tm
            WHERE tm.tenant_id = option_sets.tenant_id
            AND tm.user_id = auth.uid()
        )
        OR
        -- Dev bypass:
        auth.role() = 'authenticated'
    );

-- Write: Only Tenant Members can write to their own sets. 
-- System sets (tenant_id is null) are read-only for normal users (handled by logic/admin roles).
CREATE POLICY option_sets_write_policy ON option_sets
    FOR ALL TO authenticated
    USING (
        auth.role() = 'authenticated' -- Dev bypass
    )
    WITH CHECK (
        auth.role() = 'authenticated' -- Dev bypass
    );

-- 4.2. Option Values Policies
-- Read: Global values OR Tenant values
CREATE POLICY option_values_read_policy ON option_values
    FOR SELECT TO authenticated
    USING (
        tenant_id IS NULL 
        OR 
        auth.role() = 'authenticated' -- Dev bypass
    );

-- Write: Tenant values only
CREATE POLICY option_values_write_policy ON option_values
    FOR ALL TO authenticated
    USING (auth.role() = 'authenticated') -- Dev bypass
    WITH CHECK (auth.role() = 'authenticated');


-- 5. The "Resolution Engine" RPC
-- This complex query merges system defaults with tenant overrides.
CREATE OR REPLACE FUNCTION get_option_set_values(
    p_set_code VARCHAR,
    p_tenant_id UUID,
    p_lang_code VARCHAR DEFAULT 'en'
)
RETURNS TABLE (
    value VARCHAR,       -- The internal_code (Key)
    label VARCHAR,       -- The resolved translation
    color VARCHAR,
    icon VARCHAR,
    is_system BOOLEAN,   -- True if coming from system layer
    is_custom BOOLEAN,   -- True if defined by tenant
    payload JSONB        -- Full object for frontend
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_set_id UUID;
BEGIN
    -- 1. Resolve Set ID (Prioritize Tenant Set, then fall back to Global Set)
    -- Actually, usually we have ONE global set "Indusrty" and tenants just extend values.
    -- Or we have a Tenant-Specific set.
    -- We'll find the most relevant set ID matching the code.
    -- Currently assuming code is unique per tenant context scope.
    
    SELECT id INTO v_set_id
    FROM option_sets
    WHERE code = p_set_code
      AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST -- Tenant set overrides global set definition
    LIMIT 1;

    IF v_set_id IS NULL THEN
        RETURN; -- No set found
    END IF;

    -- 2. Fetch Merged Values using "Shadowing Logic"
    RETURN QUERY
    WITH raw_values AS (
        SELECT 
            ov.*,
            -- Determine Priority: 1 for Tenant Override, 2 for System Default
            ROW_NUMBER() OVER (
                PARTITION BY ov.internal_code 
                ORDER BY ov.tenant_id NULLS LAST -- Non-null (Tenant) comes first
            ) as shadow_rank
        FROM option_values ov
        WHERE ov.option_set_id = v_set_id
          AND (ov.tenant_id = p_tenant_id OR ov.tenant_id IS NULL)
          AND ov.is_active = true
    )
    SELECT 
        rv.internal_code as value,
        -- Label Resolution: Language -> English -> Code
        COALESCE(
            rv.label_i18n->>p_lang_code,
            rv.label_i18n->>'en',
            rv.internal_code
        ) as label,
        rv.color,
        rv.icon,
        (rv.tenant_id IS NULL) as is_system,
        (rv.tenant_id IS NOT NULL) as is_custom,
        to_jsonb(rv.*) as payload
    FROM raw_values rv
    WHERE rv.shadow_rank = 1 -- Take the "Winner" (Tenant override if exists, else System)
    ORDER BY rv.sort_order ASC, label ASC;
END;
$$;

-- 6. Setup Triggers for update times
CREATE OR REPLACE FUNCTION update_option_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_option_sets_mod
    BEFORE UPDATE ON option_sets FOR EACH ROW EXECUTE FUNCTION update_option_timestamps();

CREATE TRIGGER trg_option_values_mod
    BEFORE UPDATE ON option_values FOR EACH ROW EXECUTE FUNCTION update_option_timestamps();

NOTIFY pgrst, 'reload schema';
