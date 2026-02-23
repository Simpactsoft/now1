-- =============================================================================
-- ACTIVITY MANAGEMENT ENGINE v2.1 — PostgreSQL Schema
-- Multi-Tenant SaaS CRM with Supabase RLS
-- ★ Includes: ltree paths, PostGIS, commission tables, audit columns,
--   hierarchy history, depth-limited recursive functions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";         -- ★ Materialized path hierarchy
CREATE EXTENSION IF NOT EXISTS "postgis";       -- ★ Geographic territory queries

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION A: ENUM TYPES                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TYPE activity_type AS ENUM ('task', 'meeting', 'email');
CREATE TYPE activity_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE participant_source AS ENUM ('internal_user', 'external_contact');
CREATE TYPE participant_role AS ENUM (
    'initiator', 'assignee', 'viewer',
    'email_to', 'email_cc', 'email_bcc',
    'required', 'optional'
);
CREATE TYPE link_type AS ENUM ('follow_up', 'reply', 'related', 'parent_child');
CREATE TYPE sync_provider AS ENUM ('google', 'microsoft');
CREATE TYPE sync_status AS ENUM ('synced', 'pending_push', 'pending_pull', 'error', 'conflict');
CREATE TYPE team_member_role AS ENUM ('manager', 'member');

-- ★ Plan enum values carefully — cannot remove once added
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


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION B: ROLES & PERMISSIONS                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    hierarchy_level SMALLINT NOT NULL DEFAULT 10,  -- Lower = more privileged (1=owner)
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID,                          -- ★ Audit
    updated_by      UUID,                          -- ★ Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                   -- ★ Soft delete

    CONSTRAINT uq_role_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE TABLE role_permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission  app_permission NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_tenant ON role_permissions(tenant_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION C: TEAMS (with ltree materialized path ★)                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE teams (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    parent_team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
    manager_user_id     UUID,

    -- ★ ltree materialized path for O(1) hierarchy queries
    -- Format: "tenant_short.team_label.child_label" (updated via trigger)
    tree_path           LTREE,

    -- Geographic metadata
    region              VARCHAR(100),
    country             VARCHAR(100),
    timezone            VARCHAR(50),

    -- ★ PostGIS territory boundary (optional)
    territory_boundary  GEOMETRY(POLYGON, 4326),

    -- ★ Audit columns
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT uq_team_name_per_tenant UNIQUE (tenant_id, name),
    CONSTRAINT chk_no_self_parent CHECK (id != parent_team_id)
);

-- ★ GiST index for ltree path queries
CREATE INDEX idx_teams_tree_path ON teams USING GIST (tree_path);
CREATE INDEX idx_teams_parent ON teams(parent_team_id) WHERE parent_team_id IS NOT NULL;
-- ★ Spatial index for territory boundaries
CREATE INDEX idx_teams_territory ON teams USING GIST (territory_boundary) WHERE territory_boundary IS NOT NULL;

CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role_in_team    team_member_role NOT NULL DEFAULT 'member',
    is_primary_team BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at      TIMESTAMPTZ,                   -- ★ Soft remove

    CONSTRAINT uq_user_per_team UNIQUE (team_id, user_id)
);

-- ★ Enforce max one primary team per user per tenant
CREATE UNIQUE INDEX uq_one_primary_team
    ON team_members (tenant_id, user_id)
    WHERE is_primary_team = TRUE AND removed_at IS NULL;

CREATE INDEX idx_team_members_user ON team_members(tenant_id, user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION D: USER PROFILES & HIERARCHY                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL UNIQUE,
    role_id         UUID NOT NULL REFERENCES roles(id),
    manager_id      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    -- ★ ltree materialized path for management chain
    manager_path    LTREE,

    display_name    VARCHAR(200),
    email           VARCHAR(320),
    phone           VARCHAR(50),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at  TIMESTAMPTZ,
    created_by      UUID,                          -- ★ Audit
    updated_by      UUID,                          -- ★ Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                   -- ★ Soft delete

    CONSTRAINT uq_user_per_tenant UNIQUE (tenant_id, user_id),
    CONSTRAINT chk_not_own_manager CHECK (id != manager_id)
);

CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role_id);
CREATE INDEX idx_user_profiles_manager ON user_profiles(manager_id) WHERE manager_id IS NOT NULL;
-- ★ GiST index for management path queries
CREATE INDEX idx_user_profiles_mgr_path ON user_profiles USING GIST (manager_path);

-- ★ NEW: Manager hierarchy change audit log
CREATE TABLE user_hierarchy_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_profile_id UUID NOT NULL REFERENCES user_profiles(id),
    old_manager_id  UUID REFERENCES user_profiles(id),
    new_manager_id  UUID REFERENCES user_profiles(id),
    old_role_id     UUID REFERENCES roles(id),
    new_role_id     UUID REFERENCES roles(id),
    old_team_id     UUID REFERENCES teams(id),
    new_team_id     UUID REFERENCES teams(id),
    changed_by      UUID NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason          TEXT
);

CREATE INDEX idx_hierarchy_history_user ON user_hierarchy_history(user_profile_id, changed_at DESC);
CREATE INDEX idx_hierarchy_history_tenant ON user_hierarchy_history(tenant_id, changed_at DESC);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION E: ACTIVITY STATUS SYSTEM                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE activity_status_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    activity_type   activity_type NOT NULL,
    status_name     VARCHAR(100) NOT NULL,
    status_order    SMALLINT NOT NULL DEFAULT 0,
    color           VARCHAR(7),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed_state BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID,                          -- ★ Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_status_per_tenant_type UNIQUE (tenant_id, activity_type, status_name),
    CONSTRAINT chk_color_hex CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX uq_one_default_status
    ON activity_status_definitions (tenant_id, activity_type)
    WHERE is_default = TRUE;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION F: CORE ACTIVITIES TABLE (STI)                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Note: we need to drop public.activities since we are recreating it completely,
-- but only if there isn't data you care about. Since this is an MVP phase, 
-- we will drop and recreate.
DROP TABLE IF EXISTS public.activities CASCADE;

CREATE TABLE activities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    type                activity_type NOT NULL,

    -- Shared fields
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    status_id           UUID REFERENCES activity_status_definitions(id),
    priority            activity_priority NOT NULL DEFAULT 'normal',
    created_by          UUID NOT NULL,
    assigned_to         UUID,
    is_private          BOOLEAN NOT NULL DEFAULT false, -- From previous PR

    -- Team & Commission
    team_id             UUID REFERENCES teams(id) ON DELETE SET NULL,
    commission_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    -- ★ Snapshot commission rate at time of creation (immutable)
    commission_rate_snapshot DECIMAL(5,4),

    -- Task-specific
    due_date            DATE,

    -- Meeting-specific
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    location            VARCHAR(500),
    is_all_day          BOOLEAN DEFAULT FALSE,

    -- Email-specific
    thread_id           UUID,
    message_id          VARCHAR(500),
    in_reply_to         VARCHAR(500),
    email_references    TEXT,

    -- Threading
    parent_activity_id  UUID REFERENCES activities(id) ON DELETE SET NULL,

    -- Polymorphic entity link
    entity_type         VARCHAR(50),
    entity_id           UUID,

    -- ★ Audit columns
    updated_by          UUID,
    is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Integrity constraints
    CONSTRAINT chk_meeting_times CHECK (
        type != 'meeting' OR (start_time IS NOT NULL AND end_time IS NOT NULL)
    ),
    CONSTRAINT chk_meeting_time_order CHECK (
        start_time IS NULL OR end_time IS NULL OR end_time > start_time
    ),
    CONSTRAINT chk_entity_link_complete CHECK (
        (entity_type IS NULL AND entity_id IS NULL) OR
        (entity_type IS NOT NULL AND entity_id IS NOT NULL)
    ),
    CONSTRAINT chk_thread_email_only CHECK (
        type = 'email' OR thread_id IS NULL
    )
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION G: ACTIVITY PARTICIPANTS                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE activity_participants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    activity_id         UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    participant_source  participant_source NOT NULL,
    participant_id      UUID NOT NULL,
    role                participant_role NOT NULL,
    rsvp_status         VARCHAR(20) DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_participant_per_activity
        UNIQUE (activity_id, participant_source, participant_id, role)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION H: ACTIVITY STATUS HISTORY (Immutable Audit Log)                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE activity_status_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    old_status_id   UUID REFERENCES activity_status_definitions(id),
    new_status_id   UUID NOT NULL REFERENCES activity_status_definitions(id),
    changed_by      UUID NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT,

    CONSTRAINT chk_status_different CHECK (
        old_status_id IS NULL OR old_status_id != new_status_id
    )
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION I: ACTIVITY LINKS                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE activity_links (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id             UUID NOT NULL,
    source_activity_id    UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    target_activity_id    UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    link_type             link_type NOT NULL,
    created_by            UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_activity_link UNIQUE (source_activity_id, target_activity_id, link_type),
    CONSTRAINT chk_no_self_link CHECK (source_activity_id != target_activity_id)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION J: SYNC METADATA                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE activity_sync_metadata (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    activity_id         UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    provider            sync_provider NOT NULL,
    external_id         VARCHAR(1024) NOT NULL,
    sync_token          TEXT,
    calendar_id         VARCHAR(500),
    color_id            VARCHAR(20),        -- Google colorId (1-11) or MS category
    ical_uid            VARCHAR(500),
    etag                VARCHAR(500),
    last_synced_at      TIMESTAMPTZ,
    sync_status         sync_status NOT NULL DEFAULT 'pending_push',
    sync_error          TEXT,
    raw_metadata        JSONB DEFAULT '{}'::JSONB,

    CONSTRAINT uq_sync_per_provider UNIQUE (activity_id, provider),
    CONSTRAINT uq_external_id UNIQUE (tenant_id, provider, calendar_id, external_id)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION K: COMMISSION TABLES (★ New in v2.1)                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- K1: Commission plans per role/territory/seniority
CREATE TABLE commission_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    effective_from  DATE NOT NULL,
    effective_to    DATE,                    -- NULL = open-ended
    target_role_id  UUID REFERENCES roles(id),          -- NULL = all roles
    target_team_id  UUID REFERENCES teams(id),          -- NULL = all teams
    base_rate       DECIMAL(5,4) NOT NULL DEFAULT 0.05, -- 5% default
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL,
    updated_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_commission_plan_name UNIQUE (tenant_id, name)
);

-- K2: Commission rules (conditions, tiers, accelerators, caps, clawbacks)
CREATE TABLE commission_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    plan_id             UUID NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
    rule_name           VARCHAR(200) NOT NULL,
    rule_order          SMALLINT NOT NULL DEFAULT 0,

    -- JSONB conditions (flexible rule engine)
    -- Example: {"min_deal_value": 10000, "activity_type": "meeting", "region": "EMEA"}
    conditions          JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Rate modifiers
    rate_multiplier     DECIMAL(5,4) DEFAULT 1.0,   -- 1.0 = base rate, 1.5 = 150%
    cap_amount          DECIMAL(12,2),               -- Max commission per period
    clawback_days       INTEGER DEFAULT 0,           -- Days to reverse if deal canceled

    -- Accelerator tiers
    -- Example: [{"threshold_pct": 100, "multiplier": 1.0}, {"threshold_pct": 120, "multiplier": 1.5}]
    accelerator_tiers   JSONB DEFAULT '[]'::JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commission_rules_plan ON commission_rules(plan_id, rule_order);

-- K3: Commission splits for multi-rep deals
CREATE TABLE commission_splits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,    -- 'deal', 'opportunity'
    entity_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    split_pct       DECIMAL(5,2) NOT NULL,   -- Percentage (50.00 = 50%)
    role_in_deal    VARCHAR(100),            -- 'Closer', 'SDR', 'Account Manager'
    approved_by     UUID,                    -- ★ Approval workflow
    approved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_split_pct CHECK (split_pct > 0 AND split_pct <= 100),
    CONSTRAINT uq_split_per_entity_user UNIQUE (entity_id, entity_type, user_id)
);

CREATE INDEX idx_commission_splits_entity ON commission_splits(tenant_id, entity_type, entity_id);
CREATE INDEX idx_commission_splits_user ON commission_splits(tenant_id, user_id);

-- K4: Commission ledger (calculated payouts — append-only)
CREATE TABLE commission_ledger (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    plan_id         UUID NOT NULL REFERENCES commission_plans(id),
    activity_id     UUID REFERENCES activities(id),
    entity_type     VARCHAR(50),
    entity_id       UUID,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    deal_value      DECIMAL(12,2),
    commission_rate DECIMAL(5,4) NOT NULL,    -- Rate at time of calculation
    commission_amount DECIMAL(12,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/approved/paid/clawback
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commission_ledger_user ON commission_ledger(tenant_id, user_id, period_start);
CREATE INDEX idx_commission_ledger_status ON commission_ledger(tenant_id, status);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION L: ALL INDEXES                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Activities
CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_tenant_type ON activities(tenant_id, type);
CREATE INDEX idx_activities_tenant_status ON activities(tenant_id, status_id);
CREATE INDEX idx_activities_assigned_to ON activities(tenant_id, assigned_to);
CREATE INDEX idx_activities_team ON activities(tenant_id, team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_activities_due_date ON activities(tenant_id, due_date) WHERE type = 'task';
CREATE INDEX idx_activities_start_time ON activities(tenant_id, start_time) WHERE type = 'meeting';
CREATE INDEX idx_activities_thread ON activities(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_activities_parent ON activities(parent_activity_id) WHERE parent_activity_id IS NOT NULL;
CREATE INDEX idx_activities_entity ON activities(tenant_id, entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX idx_activities_message_id ON activities(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_activities_created_at ON activities(tenant_id, created_at DESC);
CREATE INDEX idx_activities_commission ON activities(tenant_id, commission_eligible, assigned_to) WHERE commission_eligible = TRUE;
CREATE INDEX idx_activities_deleted ON activities(tenant_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Participants
CREATE INDEX idx_participants_activity ON activity_participants(activity_id);
CREATE INDEX idx_participants_user ON activity_participants(tenant_id, participant_source, participant_id);

-- Status history
CREATE INDEX idx_status_history_activity ON activity_status_history(activity_id, changed_at DESC);

-- Links
CREATE INDEX idx_links_source ON activity_links(source_activity_id);
CREATE INDEX idx_links_target ON activity_links(target_activity_id);

-- Sync
CREATE INDEX idx_sync_activity ON activity_sync_metadata(activity_id);
CREATE INDEX idx_sync_pending ON activity_sync_metadata(sync_status) WHERE sync_status != 'synced';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION M: ROW-LEVEL SECURITY & FUNCTIONS                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- M2: Permission check
CREATE OR REPLACE FUNCTION public.has_permission(required_permission app_permission)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_profiles up
        JOIN role_permissions rp ON rp.role_id = up.role_id
        WHERE up.user_id = auth.uid()
          AND up.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
          AND rp.permission = required_permission
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ★ M3: ltree-based team hierarchy check (O(1) instead of recursive CTE)
-- Uses materialized path: check if user's team path is ancestor of target team path
CREATE OR REPLACE FUNCTION public.is_in_team_hierarchy(check_team_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM team_members tm
        JOIN teams user_team ON user_team.id = tm.team_id
        JOIN teams target_team ON target_team.id = check_team_id
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
          AND tm.removed_at IS NULL
          AND (
              user_team.id = target_team.id           -- Same team
              OR target_team.tree_path <@ user_team.tree_path  -- Target is descendant
          )
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ★ M4: ltree-based management hierarchy check (O(1))
CREATE OR REPLACE FUNCTION public.is_manager_of(target_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_profiles target_up
        JOIN user_profiles my_up ON my_up.user_id = auth.uid()
          AND my_up.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        WHERE target_up.user_id = target_user_id
          AND target_up.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
          AND target_up.manager_path <@ my_up.manager_path  -- Target is descendant
          AND target_up.id != my_up.id                      -- Not self
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ★ M5: Fallback recursive function WITH DEPTH LIMIT (max 10 levels)
-- Use only when ltree paths not yet populated
CREATE OR REPLACE FUNCTION public.is_manager_of_recursive(target_user_id UUID, max_depth INT DEFAULT 10)
RETURNS BOOLEAN AS $$
    WITH RECURSIVE management_chain AS (
        SELECT up.id, up.user_id, up.manager_id, 1 AS depth
        FROM user_profiles up
        WHERE up.user_id = target_user_id
          AND up.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        UNION ALL
        SELECT up2.id, up2.user_id, up2.manager_id, mc.depth + 1
        FROM user_profiles up2
        JOIN management_chain mc ON mc.manager_id = up2.id
        WHERE up2.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
          AND mc.depth < max_depth  -- ★ Depth limit prevents runaway recursion
    )
    SELECT EXISTS (
        SELECT 1 FROM management_chain WHERE user_id = auth.uid()
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ★ M6: Trigger to maintain team tree_path on insert/update
CREATE OR REPLACE FUNCTION update_team_tree_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    -- Convert UUID to ltree-safe label (replace hyphens with underscores)
    self_label TEXT := REPLACE(NEW.id::TEXT, '-', '_');
BEGIN
    IF NEW.parent_team_id IS NULL THEN
        NEW.tree_path := self_label::LTREE;
    ELSE
        SELECT tree_path INTO parent_path
        FROM teams WHERE id = NEW.parent_team_id;

        IF parent_path IS NOT NULL THEN
            NEW.tree_path := parent_path || self_label::LTREE;
        ELSE
            NEW.tree_path := self_label::LTREE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_team_tree_path
    BEFORE INSERT OR UPDATE OF parent_team_id ON teams
    FOR EACH ROW EXECUTE FUNCTION update_team_tree_path();

-- ★ M7: Trigger to maintain user manager_path on insert/update
CREATE OR REPLACE FUNCTION update_user_manager_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    self_label TEXT := REPLACE(NEW.id::TEXT, '-', '_');
BEGIN
    IF NEW.manager_id IS NULL THEN
        NEW.manager_path := self_label::LTREE;
    ELSE
        SELECT manager_path INTO parent_path
        FROM user_profiles WHERE id = NEW.manager_id;

        IF parent_path IS NOT NULL THEN
            NEW.manager_path := parent_path || self_label::LTREE;
        ELSE
            NEW.manager_path := self_label::LTREE;
        END IF;
    END IF;
    -- Note: This does not automatically update descendants if someone moves mid-tree.
    -- In production, a more complex trigger or background job handles sub-tree updates.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_user_manager_path
    BEFORE INSERT OR UPDATE OF manager_id ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_manager_path();

-- Enable RLS for all new tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_hierarchy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_status_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;

-- Note: we apply a simple `Activities are viewable by tenant members` based on `is_private` logic.
CREATE POLICY "Activities are viewable by tenant members" ON public.activities
    FOR SELECT
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (
            is_private = false 
            OR created_by = auth.uid() 
            OR assigned_to = auth.uid()
        )
    );
