-- =============================================================================
-- ACTIVITY MANAGEMENT ENGINE v2.1 — PostgreSQL Schema
-- Multi-Tenant SaaS CRM with Supabase RLS
-- Includes: ltree paths, PostGIS, commission tables, audit columns,
--   hierarchy history, depth-limited recursive functions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";         -- Materialized path hierarchy
CREATE EXTENSION IF NOT EXISTS "postgis";       -- Geographic territory queries

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION A: ENUM TYPES                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DO $$ BEGIN
    CREATE TYPE team_member_role AS ENUM ('manager', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE app_permission AS ENUM (
        'activities.create', 'activities.read', 'activities.read_team',
        'activities.read_all', 'activities.update', 'activities.update_team',
        'activities.update_all', 'activities.delete', 'activities.delete_all',
        'customers.create', 'customers.read', 'customers.read_team',
        'customers.read_all', 'customers.update', 'customers.delete',
        'deals.create', 'deals.read', 'deals.read_team',
        'deals.read_all', 'deals.update', 'deals.delete',
        'reports.view_own', 'reports.view_team', 'reports.view_all', 'reports.export',
        'admin.manage_users', 'admin.manage_teams', 'admin.manage_roles',
        'admin.manage_statuses', 'admin.manage_territories',
        'commissions.view_own', 'commissions.view_team', 'commissions.manage'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION B: ROLES & PERMISSIONS                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Clean slate to prevent "column does not exist" or specific null constraints
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

CREATE TABLE public.roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    hierarchy_level SMALLINT NOT NULL DEFAULT 10,
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT uq_role_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE TABLE public.role_permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL,
    role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission  app_permission NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS permission app_permission;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON public.role_permissions(tenant_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION C: TEAMS (with ltree materialized path & postgis)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

CREATE TABLE public.teams (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    parent_team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    manager_user_id     UUID,
    tree_path           LTREE,
    region              VARCHAR(100),
    country             VARCHAR(100),
    timezone            VARCHAR(50),
    territory_boundary  GEOMETRY(POLYGON, 4326),
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT uq_team_name_per_tenant UNIQUE (tenant_id, name),
    CONSTRAINT chk_no_self_parent CHECK (id != parent_team_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_tree_path ON public.teams USING GIST (tree_path);
CREATE INDEX IF NOT EXISTS idx_teams_parent ON public.teams(parent_team_id) WHERE parent_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_territory ON public.teams USING GIST (territory_boundary) WHERE territory_boundary IS NOT NULL;

CREATE TABLE public.team_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role_in_team    team_member_role NOT NULL DEFAULT 'member',
    is_primary_team BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at      TIMESTAMPTZ,

    CONSTRAINT uq_user_per_team UNIQUE (team_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_primary_team
    ON public.team_members (tenant_id, user_id)
    WHERE is_primary_team = TRUE AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION D: USER PROFILES & HIERARCHY                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
DROP TABLE IF EXISTS public.user_hierarchy_history CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

CREATE TABLE public.user_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL UNIQUE,
    role_id         UUID NOT NULL REFERENCES public.roles(id),
    manager_id      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    manager_path    LTREE,
    display_name    VARCHAR(200),
    email           VARCHAR(320),
    phone           VARCHAR(50),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at  TIMESTAMPTZ,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT uq_user_per_tenant UNIQUE (tenant_id, user_id),
    CONSTRAINT chk_not_own_manager CHECK (id != manager_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager ON public.user_profiles(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_mgr_path ON public.user_profiles USING GIST (manager_path);

CREATE TABLE public.user_hierarchy_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id),
    old_manager_id  UUID REFERENCES public.user_profiles(id),
    new_manager_id  UUID REFERENCES public.user_profiles(id),
    old_role_id     UUID REFERENCES public.roles(id),
    new_role_id     UUID REFERENCES public.roles(id),
    old_team_id     UUID REFERENCES public.teams(id),
    new_team_id     UUID REFERENCES public.teams(id),
    changed_by      UUID NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason          TEXT
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_history_user ON public.user_hierarchy_history(user_profile_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hierarchy_history_tenant ON public.user_hierarchy_history(tenant_id, changed_at DESC);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION E: UPDATE ACTIVITIES TABLE                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS commission_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS commission_rate_snapshot DECIMAL(5,4);

CREATE INDEX IF NOT EXISTS idx_activities_team ON public.activities(tenant_id, team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_commission ON public.activities(tenant_id, commission_eligible, owner_id) WHERE commission_eligible = TRUE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION F: COMMISSION TABLES                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.commission_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    target_role_id  UUID REFERENCES public.roles(id),
    target_team_id  UUID REFERENCES public.teams(id),
    base_rate       DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_commission_plan_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.commission_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    plan_id             UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
    rule_name           VARCHAR(200) NOT NULL,
    rule_order          SMALLINT NOT NULL DEFAULT 0,
    conditions          JSONB NOT NULL DEFAULT '{}'::JSONB,
    rate_multiplier     DECIMAL(5,4) DEFAULT 1.0,
    cap_amount          DECIMAL(12,2),
    clawback_days       INTEGER DEFAULT 0,
    accelerator_tiers   JSONB DEFAULT '[]'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_plan ON public.commission_rules(plan_id, rule_order);

CREATE TABLE IF NOT EXISTS public.commission_splits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    split_pct       DECIMAL(5,2) NOT NULL,
    role_in_deal    VARCHAR(100),
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_split_pct CHECK (split_pct > 0 AND split_pct <= 100),
    CONSTRAINT uq_split_per_entity_user UNIQUE (entity_id, entity_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_splits_entity ON public.commission_splits(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_user ON public.commission_splits(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS public.commission_ledger (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL,
    user_id           UUID NOT NULL,
    plan_id           UUID NOT NULL REFERENCES public.commission_plans(id),
    activity_id       UUID REFERENCES public.activities(id),
    entity_type       VARCHAR(50),
    entity_id         UUID,
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    deal_value        DECIMAL(12,2),
    commission_rate   DECIMAL(5,4) NOT NULL,
    commission_amount DECIMAL(12,2) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by       UUID,
    approved_at       TIMESTAMPTZ,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_user ON public.commission_ledger(tenant_id, user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON public.commission_ledger(tenant_id, status);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION G: ROW-LEVEL SECURITY & FUNCTIONS                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.has_permission(required_permission app_permission)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.role_permissions rp ON rp.role_id = up.role_id
        WHERE up.user_id = auth.uid()
          AND up.tenant_id = get_current_tenant_id()
          AND rp.permission = required_permission
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_in_team_hierarchy(check_team_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.teams user_team ON user_team.id = tm.team_id
        JOIN public.teams target_team ON target_team.id = check_team_id
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = get_current_tenant_id()
          AND tm.removed_at IS NULL
          AND (
              user_team.id = target_team.id
              OR target_team.tree_path <@ user_team.tree_path
          )
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_of(target_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles target_up
        JOIN public.user_profiles my_up ON my_up.user_id = auth.uid()
          AND my_up.tenant_id = get_current_tenant_id()
        WHERE target_up.user_id = target_user_id
          AND target_up.tenant_id = get_current_tenant_id()
          AND target_up.manager_path <@ my_up.manager_path
          AND target_up.id != my_up.id
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_of_recursive(target_user_id UUID, max_depth INT DEFAULT 10)
RETURNS BOOLEAN AS $$
    WITH RECURSIVE management_chain AS (
        SELECT up.id, up.user_id, up.manager_id, 1 AS depth
        FROM public.user_profiles up
        WHERE up.user_id = target_user_id
          AND up.tenant_id = get_current_tenant_id()
        UNION ALL
        SELECT up2.id, up2.user_id, up2.manager_id, mc.depth + 1
        FROM public.user_profiles up2
        JOIN management_chain mc ON mc.manager_id = up2.id
        WHERE up2.tenant_id = get_current_tenant_id()
          AND mc.depth < max_depth
    )
    SELECT EXISTS (SELECT 1 FROM management_chain WHERE user_id = auth.uid());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_team_tree_path() RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    self_label TEXT := REPLACE(NEW.id::TEXT, '-', '_');
BEGIN
    IF NEW.parent_team_id IS NULL THEN
        NEW.tree_path := self_label::LTREE;
    ELSE
        SELECT tree_path INTO parent_path FROM public.teams WHERE id = NEW.parent_team_id;
        IF parent_path IS NOT NULL THEN
            NEW.tree_path := parent_path || self_label::LTREE;
        ELSE
            NEW.tree_path := self_label::LTREE;
        END IF;
    END IF;

    IF nlevel(NEW.tree_path) > 10 THEN
        RAISE EXCEPTION 'Team hierarchy cannot exceed 10 levels';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_tree_path ON public.teams;
CREATE TRIGGER trg_team_tree_path
    BEFORE INSERT OR UPDATE OF parent_team_id ON public.teams
    FOR EACH ROW EXECUTE FUNCTION update_team_tree_path();

CREATE OR REPLACE FUNCTION update_user_manager_path() RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    self_label TEXT := REPLACE(NEW.id::TEXT, '-', '_');
BEGIN
    IF NEW.manager_id IS NULL THEN
        NEW.manager_path := self_label::LTREE;
    ELSE
        SELECT manager_path INTO parent_path FROM public.user_profiles WHERE id = NEW.manager_id;
        IF parent_path IS NOT NULL THEN
            NEW.manager_path := parent_path || self_label::LTREE;
        ELSE
            NEW.manager_path := self_label::LTREE;
        END IF;
    END IF;

    IF nlevel(NEW.manager_path) > 10 THEN
        RAISE EXCEPTION 'Management hierarchy cannot exceed 10 levels';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_manager_path ON public.user_profiles;
CREATE TRIGGER trg_user_manager_path
    BEFORE INSERT OR UPDATE OF manager_id ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_manager_path();

CREATE OR REPLACE FUNCTION log_hierarchy_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.manager_id IS DISTINCT FROM NEW.manager_id OR OLD.role_id IS DISTINCT FROM NEW.role_id THEN
        INSERT INTO public.user_hierarchy_history (
            tenant_id, user_profile_id, old_manager_id, new_manager_id, old_role_id, new_role_id, changed_by, reason
        ) VALUES (
            NEW.tenant_id, NEW.id, OLD.manager_id, NEW.manager_id, OLD.role_id, NEW.role_id,
            COALESCE(NEW.updated_by, auth.uid()), 'Automatic log from profile update'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_hierarchy_change ON public.user_profiles;
CREATE TRIGGER trg_log_hierarchy_change
    AFTER UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION log_hierarchy_change();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION H: APPLY RLS POLICIES (ISOLATION)                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hierarchy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for roles" ON public.roles FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for role_permissions" ON public.role_permissions FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for teams" ON public.teams FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for team_members" ON public.team_members FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for user_profiles" ON public.user_profiles FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for hierarchy hist" ON public.user_hierarchy_history FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for comm plans" ON public.commission_plans FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for comm rules" ON public.commission_rules FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for comm splits" ON public.commission_splits FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Tenant isolation for comm ledger" ON public.commission_ledger FOR ALL USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
