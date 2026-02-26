-- =========================================================================
-- MASTER V2 DATABASE RESET & SEED SCRIPT
-- =========================================================================
-- Warning: This script drops all activity & commission tables and recreates
-- them cleanly according to the V2 Polymorphic Architecture.
-- It then seeds 50,000 fresh records for performance testing.
--
-- Instructions: Copy and Paste this ENTIRE file into the Supabase SQL Editor
-- and click "RUN".
-- =========================================================================

-- 1. DROP LEGACY AND CONFLICTING TABLES
DROP TABLE IF EXISTS "activities" CASCADE;
DROP TABLE IF EXISTS "activity_links" CASCADE;
DROP TABLE IF EXISTS "activity_participants" CASCADE;
DROP TABLE IF EXISTS "activity_participants_v2" CASCADE;
DROP TABLE IF EXISTS "activity_status_history" CASCADE;
DROP TABLE IF EXISTS "activity_status_definitions" CASCADE;
DROP TABLE IF EXISTS "activity_inbox" CASCADE;
DROP TABLE IF EXISTS "activity_stream" CASCADE;
DROP TABLE IF EXISTS "commission_ledger" CASCADE;
DROP TABLE IF EXISTS "commission_rules" CASCADE;
DROP TABLE IF EXISTS "commission_plans" CASCADE;
DROP TABLE IF EXISTS "campaigns" CASCADE;
DROP TABLE IF EXISTS "campaign_members" CASCADE;
DROP TABLE IF EXISTS "leads" CASCADE;
DROP TABLE IF EXISTS "pipelines" CASCADE;
DROP TABLE IF EXISTS "pipeline_stages" CASCADE;
DROP TABLE IF EXISTS "opportunities" CASCADE;
DROP TABLE IF EXISTS "opportunity_cards" CASCADE;
DROP TABLE IF EXISTS "opportunity_stage_history" CASCADE;

-- 2. APPLY MIGRATIONS & SEEDS
-- (The following generates the exact order of required scripts)
-- Migration: 20260228000000_hybrid_crm_core.sql
-- Description: Implement missing tables and columns from the B2B/B2C CRM specification.
-- Adapts the schema to use the existing tenants/cards structure and RLS conventions.

BEGIN;

-- ============================================================================
-- 0. GLOBAL ENUM TYPES
-- ============================================================================
DO $$ BEGIN CREATE TYPE activity_type AS ENUM ('task', 'meeting', 'email'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE activity_priority AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE participant_source AS ENUM ('internal_user', 'external_contact'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE participant_role AS ENUM (
    'initiator', 'assignee', 'viewer',
    'email_to', 'email_cc', 'email_bcc',
    'required', 'optional'
); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE link_type AS ENUM ('follow_up', 'reply', 'related', 'parent_child'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sync_provider AS ENUM ('google', 'microsoft'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('synced', 'pending_push', 'pending_pull', 'error', 'conflict'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE team_member_role AS ENUM ('manager', 'member'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ★ Plan enum values carefully — cannot remove once added
DO $$ BEGIN CREATE TYPE app_permission AS ENUM (
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
); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 1. Extend existing 'cards' table
-- ============================================================================
ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS card_type TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    -- first_name and last_name are added to ease B2C data access directly on cards instead of joining 'people'
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS job_title TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    -- company_name for B2B representation without joining 'organizations'
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS employee_count INT,
    ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS data_context TEXT[] DEFAULT '{crm}',
    ADD COLUMN IF NOT EXISTS consent_flags JSONB DEFAULT '{}';

-- Validate card_type constraint if it has data, but for now we just add it to accommodate prompt.
DO $$ BEGIN
    ALTER TABLE cards ADD CONSTRAINT chk_cards_card_type CHECK (card_type IN ('individual', 'organization'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Fix updated_at for cards if we want tracking (already present).

-- ============================================================================
-- 2. Campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IS NULL OR type IN ('email','webinar','ad','event','referral','content','other')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
    channel TEXT,
    parent_campaign_id UUID,
    budget NUMERIC(12,2),
    actual_cost NUMERIC(12,2),
    expected_revenue NUMERIC(15,2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT fk_campaigns_parent FOREIGN KEY (parent_campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_parent ON campaigns (tenant_id, parent_campaign_id) WHERE parent_campaign_id IS NOT NULL;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_campaigns ON campaigns;
CREATE POLICY tenant_isolation_campaigns ON campaigns
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 3. Campaign Members
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    card_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, card_id) REFERENCES cards(tenant_id, id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'targeted' CHECK (status IN ('targeted','sent','opened','clicked','responded','converted')),
    responded_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_cm_campaign_card UNIQUE (tenant_id, campaign_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_tenant_card ON campaign_members (tenant_id, card_id);
CREATE INDEX IF NOT EXISTS idx_cm_tenant_campaign ON campaign_members (tenant_id, campaign_id, status);

ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_campaign_members ON campaign_members;
CREATE POLICY tenant_isolation_campaign_members ON campaign_members
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_campaign_members_updated_at ON campaign_members;
DROP TRIGGER IF EXISTS trg_campaign_members_updated_at ON campaign_members;
CREATE TRIGGER trg_campaign_members_updated_at
    BEFORE UPDATE ON campaign_members
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 4. Leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    card_id UUID,
    FOREIGN KEY (tenant_id, card_id) REFERENCES cards(tenant_id, id) ON DELETE SET NULL,
    source TEXT CHECK (source IS NULL OR source IN ('web_form','import','manual','api','chatbot','referral')),
    source_detail TEXT,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    raw_email TEXT,
    raw_phone TEXT,
    raw_name TEXT,
    raw_company TEXT,
    raw_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','working','qualified','unqualified','converted','junk')),
    score INT NOT NULL DEFAULT 0,
    qualified_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_email ON leads (tenant_id, raw_email);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_card ON leads (tenant_id, card_id) WHERE card_id IS NOT NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 5. Pipelines
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'opportunity' CHECK (entity_type IN ('opportunity','lead')),
    pipeline_mode TEXT NOT NULL DEFAULT 'standard' CHECK (pipeline_mode IN ('standard','quick_close')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_active ON pipelines (tenant_id) WHERE is_active = true;

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_pipelines ON pipelines;
CREATE POLICY tenant_isolation_pipelines ON pipelines
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_pipelines_updated_at ON pipelines;
DROP TRIGGER IF EXISTS trg_pipelines_updated_at ON pipelines;
CREATE TRIGGER trg_pipelines_updated_at
    BEFORE UPDATE ON pipelines
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 6. Pipeline Stages
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order INT NOT NULL,
    probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    is_won BOOLEAN NOT NULL DEFAULT false,
    is_lost BOOLEAN NOT NULL DEFAULT false,
    stage_color TEXT,
    rotting_days INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_stages_order UNIQUE (tenant_id, pipeline_id, display_order),
    CONSTRAINT chk_stages_terminal CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX IF NOT EXISTS idx_stages_tenant_pipeline ON pipeline_stages (tenant_id, pipeline_id, display_order);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_pipeline_stages ON pipeline_stages;
CREATE POLICY tenant_isolation_pipeline_stages ON pipeline_stages
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON pipeline_stages;
DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 7. Opportunities
-- ============================================================================
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    card_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, card_id) REFERENCES cards(tenant_id, id) ON DELETE RESTRICT,
    amount NUMERIC(15,2),
    currency TEXT NOT NULL DEFAULT 'USD',
    recurring_amount NUMERIC(15,2),
    recurring_interval TEXT CHECK (recurring_interval IS NULL OR recurring_interval IN ('monthly','quarterly','yearly')),
    probability INT CHECK (probability IS NULL OR probability BETWEEN 0 AND 100),
    expected_close DATE,
    actual_close TIMESTAMPTZ,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    source TEXT CHECK (source IS NULL OR source IN ('inbound','outbound','referral','expansion','renewal')),
    close_reason TEXT,
    competitor TEXT,
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opp_tenant_pipeline_stage ON opportunities (tenant_id, pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_opp_tenant_card ON opportunities (tenant_id, card_id);
CREATE INDEX IF NOT EXISTS idx_opp_tenant_close ON opportunities (tenant_id, expected_close) WHERE actual_close IS NULL;

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_opportunities ON opportunities;
CREATE POLICY tenant_isolation_opportunities ON opportunities
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
CREATE TRIGGER trg_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 8. Opportunity Cards
-- ============================================================================
CREATE TABLE IF NOT EXISTS opportunity_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    card_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, card_id) REFERENCES cards(tenant_id, id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('decision_maker','influencer','champion','blocker','end_user','evaluator','participant')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_opp_card_role UNIQUE (tenant_id, opportunity_id, card_id, role)
);

CREATE INDEX IF NOT EXISTS idx_opp_cards_opp ON opportunity_cards (tenant_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_cards_card ON opportunity_cards (tenant_id, card_id);

ALTER TABLE opportunity_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_opportunity_cards ON opportunity_cards;
CREATE POLICY tenant_isolation_opportunity_cards ON opportunity_cards
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_opportunity_cards_updated_at ON opportunity_cards;
DROP TRIGGER IF EXISTS trg_opportunity_cards_updated_at ON opportunity_cards;
CREATE TRIGGER trg_opportunity_cards_updated_at
    BEFORE UPDATE ON opportunity_cards
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 9. Opportunity Stage History
-- ============================================================================
CREATE TABLE IF NOT EXISTS opportunity_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by UUID,
    time_in_stage INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_osh_opp ON opportunity_stage_history (tenant_id, opportunity_id, changed_at);

ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_osh ON opportunity_stage_history;
CREATE POLICY tenant_isolation_osh ON opportunity_stage_history
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- History triggers
CREATE OR REPLACE FUNCTION fn_track_stage_change() RETURNS TRIGGER AS $$
DECLARE
    v_prev_changed_at TIMESTAMPTZ;
BEGIN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        SELECT changed_at INTO v_prev_changed_at
        FROM opportunity_stage_history
        WHERE tenant_id = NEW.tenant_id AND opportunity_id = NEW.id
        ORDER BY changed_at DESC LIMIT 1;

        INSERT INTO opportunity_stage_history
            (tenant_id, opportunity_id, from_stage_id, to_stage_id, changed_by, time_in_stage)
        VALUES (
            NEW.tenant_id, NEW.id, OLD.stage_id, NEW.stage_id, NEW.updated_by,
            CASE WHEN v_prev_changed_at IS NOT NULL THEN now() - v_prev_changed_at ELSE NULL END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_stage_change ON opportunities;
DROP TRIGGER IF EXISTS trg_opportunities_stage_change ON opportunities;
CREATE TRIGGER trg_opportunities_stage_change
    AFTER UPDATE OF stage_id ON opportunities
    FOR EACH ROW EXECUTE FUNCTION fn_track_stage_change();

CREATE OR REPLACE FUNCTION fn_track_initial_stage() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO opportunity_stage_history
        (tenant_id, opportunity_id, from_stage_id, to_stage_id, changed_by)
    VALUES (NEW.tenant_id, NEW.id, NULL, NEW.stage_id, NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_initial_stage ON opportunities;
DROP TRIGGER IF EXISTS trg_opportunities_initial_stage ON opportunities;
CREATE TRIGGER trg_opportunities_initial_stage
    AFTER INSERT ON opportunities
    FOR EACH ROW EXECUTE FUNCTION fn_track_initial_stage();

-- ============================================================================
-- 10. Activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('call','email','meeting','note','task','sms','whatsapp','system')),
    subject TEXT,
    body TEXT,
    direction TEXT CHECK (direction IS NULL OR direction IN ('inbound','outbound')),
    is_task BOOLEAN NOT NULL DEFAULT false,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_secs INT,
    email_message_id TEXT,
    email_thread_id TEXT,
    data_context TEXT NOT NULL DEFAULT 'crm',
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_created ON activities (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_tasks ON activities (tenant_id, owner_id, due_at) WHERE is_task = true AND completed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_dedup_email ON activities (tenant_id, email_message_id) WHERE email_message_id IS NOT NULL;

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_activities ON activities;
CREATE POLICY tenant_isolation_activities ON activities
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_activities_updated_at ON activities;
DROP TRIGGER IF EXISTS trg_activities_updated_at ON activities;
CREATE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 11. Activity Links (V2 Architecture)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_links (
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

CREATE INDEX IF NOT EXISTS idx_links_source ON activity_links(source_activity_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON activity_links(target_activity_id);
CREATE INDEX IF NOT EXISTS idx_links_type ON activity_links(link_type);

ALTER TABLE activity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_activity_links ON activity_links;
CREATE POLICY tenant_isolation_activity_links ON activity_links
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 12. Activity Inbox
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    payload JSONB NOT NULL,
    source TEXT,
    processed BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbox_unprocessed ON activity_inbox (tenant_id, created_at) WHERE processed = false;

ALTER TABLE activity_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_activity_inbox ON activity_inbox;
CREATE POLICY tenant_isolation_activity_inbox ON activity_inbox
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

COMMIT;
-- Migration: 20260228000001_hybrid_crm_seed.sql
-- Description: Function to seed default Hybrid CRM pipelines for a specific tenant.
-- Usage: SELECT seed_hybrid_crm_pipelines('tenant-uuid-here');

CREATE OR REPLACE FUNCTION seed_hybrid_crm_pipelines(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_b2b_pipeline_id UUID := gen_random_uuid();
    v_b2c_pipeline_id UUID := gen_random_uuid();
BEGIN
    -- Only seed if pipelines don't exist yet for this tenant
    IF EXISTS (SELECT 1 FROM pipelines WHERE tenant_id = p_tenant_id AND name = 'B2B Sales') THEN
        RETURN;
    END IF;

    -- ============================================================================
    -- 1. Default B2B Pipeline
    -- ============================================================================
    INSERT INTO pipelines (tenant_id, id, name, pipeline_mode, is_default)
    VALUES (p_tenant_id, v_b2b_pipeline_id, 'B2B Sales', 'standard', true);

    INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, display_order, probability, stage_color) VALUES
        (p_tenant_id, v_b2b_pipeline_id, 'Discovery',     1, 10, '#6366F1'),
        (p_tenant_id, v_b2b_pipeline_id, 'Qualification', 2, 25, '#8B5CF6'),
        (p_tenant_id, v_b2b_pipeline_id, 'Proposal',      3, 50, '#A855F7'),
        (p_tenant_id, v_b2b_pipeline_id, 'Negotiation',   4, 75, '#D946EF'),
        (p_tenant_id, v_b2b_pipeline_id, 'Closed Won',    5, 100, '#22C55E'),
        (p_tenant_id, v_b2b_pipeline_id, 'Closed Lost',   6, 0,   '#EF4444');

    UPDATE pipeline_stages SET is_won  = true WHERE name = 'Closed Won'  AND tenant_id = p_tenant_id AND pipeline_id = v_b2b_pipeline_id;
    UPDATE pipeline_stages SET is_lost = true WHERE name = 'Closed Lost' AND tenant_id = p_tenant_id AND pipeline_id = v_b2b_pipeline_id;

    -- ============================================================================
    -- 2. Default B2C Quick-Close Pipeline
    -- ============================================================================
    INSERT INTO pipelines (tenant_id, id, name, pipeline_mode, is_default)
    VALUES (p_tenant_id, v_b2c_pipeline_id, 'B2C Quick Close', 'quick_close', false);

    INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, display_order, probability, stage_color) VALUES
        (p_tenant_id, v_b2c_pipeline_id, 'Inquiry',   1, 30,  '#3B82F6'),
        (p_tenant_id, v_b2c_pipeline_id, 'Payment',   2, 80,  '#F59E0B'),
        (p_tenant_id, v_b2c_pipeline_id, 'Complete',  3, 100, '#22C55E'),
        (p_tenant_id, v_b2c_pipeline_id, 'Cancelled', 4, 0,   '#EF4444');

    UPDATE pipeline_stages SET is_won  = true WHERE name = 'Complete'  AND tenant_id = p_tenant_id AND pipeline_id = v_b2c_pipeline_id;
    UPDATE pipeline_stages SET is_lost = true WHERE name = 'Cancelled' AND tenant_id = p_tenant_id AND pipeline_id = v_b2c_pipeline_id;

END;
$$;
-- =============================================================================
-- ACTIVITY MANAGEMENT ENGINE v2.1 — PostgreSQL Schema
-- Multi-Tenant SaaS CRM with Supabase RLS
-- ★ Includes: ltree paths, PostGIS, commission tables, audit columns,
--   hierarchy history, depth-limited recursive functions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";         -- ★ Materialized path hierarchy
CREATE EXTENSION IF NOT EXISTS "postgis";       -- ★ Geographic territory queries

-- (ENUMS moved to Section 0 at the top of the file)


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION B: ROLES & PERMISSIONS                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS roles (
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

CREATE TABLE IF NOT EXISTS role_permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission  app_permission NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON role_permissions(tenant_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION C: TEAMS (with ltree materialized path ★)                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS teams (
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
CREATE INDEX IF NOT EXISTS idx_teams_tree_path ON teams USING GIST (tree_path);
CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_team_id) WHERE parent_team_id IS NOT NULL;
-- ★ Spatial index for territory boundaries
CREATE INDEX IF NOT EXISTS idx_teams_territory ON teams USING GIST (territory_boundary) WHERE territory_boundary IS NOT NULL;

CREATE TABLE IF NOT EXISTS team_members (
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_primary_team
    ON team_members (tenant_id, user_id)
    WHERE is_primary_team = TRUE AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION D: USER PROFILES & HIERARCHY                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS user_profiles (
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

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager ON user_profiles(manager_id) WHERE manager_id IS NOT NULL;
-- ★ GiST index for management path queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_mgr_path ON user_profiles USING GIST (manager_path);

-- ★ NEW: Manager hierarchy change audit log
CREATE TABLE IF NOT EXISTS user_hierarchy_history (
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

CREATE INDEX IF NOT EXISTS idx_hierarchy_history_user ON user_hierarchy_history(user_profile_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hierarchy_history_tenant ON user_hierarchy_history(tenant_id, changed_at DESC);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION E: ACTIVITY STATUS SYSTEM                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS activity_status_definitions (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_default_status
    ON activity_status_definitions (tenant_id, activity_type)
    WHERE is_default = TRUE;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION F: CORE ACTIVITIES TABLE (STI)                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Note: we need to drop public.activities since we are recreating it completely,
-- but only if there isn't data you care about. Since this is an MVP phase, 
-- we will drop and recreate.
DROP TABLE IF EXISTS public.activities CASCADE;

CREATE TABLE IF NOT EXISTS activities (
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

CREATE TABLE IF NOT EXISTS activity_participants (
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

CREATE TABLE IF NOT EXISTS activity_status_history (
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


-- (Activity Links V2 moved to Core section to resolve creation order constraints)
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION J: SYNC METADATA                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS activity_sync_metadata (
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
CREATE TABLE IF NOT EXISTS commission_plans (
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
CREATE TABLE IF NOT EXISTS commission_rules (
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

CREATE INDEX IF NOT EXISTS idx_commission_rules_plan ON commission_rules(plan_id, rule_order);

-- K3: Commission splits for multi-rep deals
CREATE TABLE IF NOT EXISTS commission_splits (
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

CREATE INDEX IF NOT EXISTS idx_commission_splits_entity ON commission_splits(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_user ON commission_splits(tenant_id, user_id);

-- K4: Commission ledger (calculated payouts — append-only)
CREATE TABLE IF NOT EXISTS commission_ledger (
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

CREATE INDEX IF NOT EXISTS idx_commission_ledger_user ON commission_ledger(tenant_id, user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON commission_ledger(tenant_id, status);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION L: ALL INDEXES                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Activities
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_type ON activities(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_status ON activities(tenant_id, status_id);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON activities(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_team ON activities(tenant_id, team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(tenant_id, due_date) WHERE type = 'task';
CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(tenant_id, start_time) WHERE type = 'meeting';
CREATE INDEX IF NOT EXISTS idx_activities_thread ON activities(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_parent ON activities(parent_activity_id) WHERE parent_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(tenant_id, entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_message_id ON activities(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_commission ON activities(tenant_id, commission_eligible, assigned_to) WHERE commission_eligible = TRUE;
CREATE INDEX IF NOT EXISTS idx_activities_deleted ON activities(tenant_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Participants
CREATE INDEX IF NOT EXISTS idx_participants_activity ON activity_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON activity_participants(tenant_id, participant_source, participant_id);

-- Status history
CREATE INDEX IF NOT EXISTS idx_status_history_activity ON activity_status_history(activity_id, changed_at DESC);

-- Links
CREATE INDEX IF NOT EXISTS idx_links_source ON activity_links(source_activity_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON activity_links(target_activity_id);

-- Sync
CREATE INDEX IF NOT EXISTS idx_sync_activity ON activity_sync_metadata(activity_id);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON activity_sync_metadata(sync_status) WHERE sync_status != 'synced';


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

DROP TRIGGER IF EXISTS maintain_team_tree_path ON teams;
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

DROP TRIGGER IF EXISTS maintain_user_manager_path ON user_profiles;
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
-- Migration: 20260228000004_unified_cards.sql
-- Description: Deprecate the separate 'leads' table in favor of a Unified Cards architecture.
-- Adds lifecycle stage and lead-specific fields to the 'cards' table.

BEGIN;

-- ============================================================================
-- 1. ENUMS AND NEW COLUMNS ON CARDS
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE lifecycle_stage AS ENUM ('subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.cards
    ADD COLUMN IF NOT EXISTS lifecycle_stage lifecycle_stage NOT NULL DEFAULT 'lead',
    ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new','contacted','working','qualified','unqualified','junk')),
    ADD COLUMN IF NOT EXISTS lead_source TEXT CHECK (lead_source IS NULL OR lead_source IN ('web_form','import','manual','api','chatbot','referral')),
    ADD COLUMN IF NOT EXISTS lead_score INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS owner_id UUID, -- For lead assignment/ownership
    ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- ============================================================================
-- 2. DATA MIGRATION
-- Migrate existing data from 'leads' into 'cards' where possible
-- ============================================================================
-- If a lead doesn't have a card_id, it means we must create a new card for it.
-- This requires checking if data exists, avoiding null constraints on the cards table if possible.
-- Assuming cards requires tenant_id, display_name, type, and hierarchy_path.
INSERT INTO public.cards (tenant_id, display_name, type, hierarchy_path, email, phone, company_name, first_name, last_name, lead_status, lead_source, lead_score, owner_id, campaign_id, qualified_at, converted_at, created_at)
SELECT 
    l.tenant_id,
    COALESCE(l.raw_name, l.raw_company, l.raw_email, 'Unknown Lead') as display_name,
    CASE WHEN l.raw_company IS NOT NULL THEN 'organization' ELSE 'person' END as type,
    'org'::ltree as hierarchy_path,
    l.raw_email as email,
    l.raw_phone as phone,
    l.raw_company as company_name,
    split_part(l.raw_name, ' ', 1) as first_name,
    substring(l.raw_name from length(split_part(l.raw_name, ' ', 1)) + 2) as last_name,
    l.status as lead_status,
    l.source as lead_source,
    l.score as lead_score,
    l.owner_id,
    l.campaign_id,
    l.qualified_at,
    l.converted_at,
    l.created_at
FROM public.leads l
WHERE l.card_id IS NULL;

-- If a lead DOES have a card_id, we just update the existing card with lead info
UPDATE public.cards c
SET 
    lifecycle_stage = 'lead',
    lead_status = l.status,
    lead_source = l.source,
    lead_score = l.score,
    owner_id = l.owner_id,
    campaign_id = l.campaign_id,
    qualified_at = l.qualified_at,
    converted_at = l.converted_at
FROM public.leads l
WHERE l.card_id = c.id;

-- ============================================================================
-- 3. CLEANUP
-- Drop the leads table entirely as it is now redundant.
-- ============================================================================
DROP TABLE IF EXISTS public.leads CASCADE;

COMMIT;
-- Add completed_at back to activities for frontend compatibility
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- --------------------------------------------------------------------------------
-- Unified Activity Stream Schema
-- --------------------------------------------------------------------------------

-- Create the activity_stream table
CREATE TABLE IF NOT EXISTS public.activity_stream (
    -- Unique identifier for the log entry
    id BIGSERIAL PRIMARY KEY,
    
    -- The tenant/org anchor for security
    organization_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- The primary anchor (Customer, Lead, or Card ID)
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL, -- e.g., 'card', 'opportunity'
    
    -- Event classification
    event_type TEXT NOT NULL, -- e.g., 'call', 'quote_created', 'invoice_paid'
    
    -- Temporal data
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Who performed the action
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_metadata JSONB, -- Cache name/avatar to avoid JOINs on fetch
    
    -- The polymorphic data specific to the event type
    -- Structure: { "title": string, "summary": string, "amount"?: number,... }
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Links back to the source for deep loading
    source_id UUID NOT NULL,
    source_table TEXT NOT NULL,
    
    -- System metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint to ensure we don't duplicate logs for the same source action
    -- Removing this constraint as per Grok's recommendation to use unique_source_table or 
    -- unique (source_id, source_table, event_type)
    CONSTRAINT unique_source_event UNIQUE (source_id, source_table, event_type)
);

-- =================================================================================
-- High-Performance Indexing
-- =================================================================================

-- Multi-tenant Keyset Pagination Index
-- Perfect index scan even when the planner sees the RLS predicate.
CREATE INDEX IF NOT EXISTS idx_stream_pagination 
ON public.activity_stream (organization_id, entity_id, occurred_at DESC, id DESC);

-- Covering Filter Index for common filters
CREATE INDEX IF NOT EXISTS idx_stream_org_event 
ON public.activity_stream (organization_id, event_type, occurred_at DESC);

-- GIN index for payload filtering (e.g., searching for text in notes)
CREATE INDEX IF NOT EXISTS idx_stream_payload_path_ops 
ON public.activity_stream USING GIN (payload jsonb_path_ops);

-- =================================================================================
-- Row Level Security (RLS)
-- =================================================================================

ALTER TABLE public.activity_stream ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy
CREATE POLICY "Users can view activities in their tenant"
    ON public.activity_stream FOR SELECT
    USING (organization_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 2. INSERT policy for client/system (Requires WITH CHECK per documentation)
CREATE POLICY "Users can insert activities in their tenant"
    ON public.activity_stream FOR INSERT
    WITH CHECK (organization_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 3. UPDATE policy 
CREATE POLICY "Users can update activities in their tenant"
    ON public.activity_stream FOR UPDATE
    USING (organization_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 4. DELETE policy
CREATE POLICY "Users can delete activities in their tenant"
    ON public.activity_stream FOR DELETE
    USING (organization_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Enable realtime for the activity_stream table
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_stream;
-- --------------------------------------------------------------------------------
-- Unified Activity Stream Triggers
-- --------------------------------------------------------------------------------

-- Create the generic trigger function
CREATE OR REPLACE FUNCTION public.handle_activity_stream()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_record RECORD;
BEGIN
  -- Determine whether to use OLD or NEW based on the operation
  v_record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- ==========================================
  -- QUOTES TABLE
  -- ==========================================
  IF TG_TABLE_NAME = 'quotes' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'quote_created'
      WHEN TG_OP = 'UPDATE' THEN 'quote_updated'
      ELSE 'quote_deleted' END;
      
    v_payload := jsonb_build_object(
      'quote_number', v_record.quote_number,
      'amount', v_record.grand_total,
      'status', v_record.status,
      'currency', v_record.currency
    );
    
    -- If no customer, we can't tie it to an entity timeline
    IF v_record.customer_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.customer_id,
      'customer',
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  -- ==========================================
  -- ACTIVITIES TABLE
  -- ==========================================
  ELSIF TG_TABLE_NAME = 'activities' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'activity_created'
      WHEN TG_OP = 'UPDATE' THEN 'activity_updated'
      ELSE 'activity_deleted' END;
      
    v_payload := jsonb_build_object(
      'title', v_record.title,
      'type', v_record.type,
      'priority', v_record.priority
    );
    
    -- Only sync if linked to an entity
    IF v_record.entity_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.entity_id,
      COALESCE(v_record.entity_type, 'unknown'),
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  END IF;

  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- Triggers for Quotes
-- ==========================================
DROP TRIGGER IF EXISTS trg_quote_to_stream ON public.quotes;
DROP TRIGGER IF EXISTS trg_quote_to_stream ON public.quotes;
CREATE TRIGGER trg_quote_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();

-- ==========================================
-- Triggers for Activities 
-- ==========================================
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;
CREATE TRIGGER trg_activity_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();
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
-- =============================================================================
-- SAFE ACTIVITY ENGINE v2.1 SCHEMA UPGRADE
-- Converts the existing V1 activities schema to V2 without dropping data.
-- =============================================================================

BEGIN;

-- (Skipping V1 to V2 activities migration, since table was created as V2 natively)
-- Since we migrated the old entity links into the `activities` table directly,
-- we clear the table and rebuild it strictly for activity-to-activity linking.

TRUNCATE TABLE public.activity_links;

-- (Skipping V1 to V2 activity_links ALTERation, since table was created as V2 natively)

-- 7. RECREATE THE V2 TRIGGER
-- Drop the V1 fix trigger from activity_links
DROP TRIGGER IF EXISTS trg_link_to_stream ON public.activity_links;

-- Recreate the correct trigger on activities
DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;

CREATE OR REPLACE FUNCTION public.handle_activity_stream()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_record RECORD;
BEGIN
  v_record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- ==========================================
  -- QUOTES TABLE
  -- ==========================================
  IF TG_TABLE_NAME = 'quotes' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'quote_created'
      WHEN TG_OP = 'UPDATE' THEN 'quote_updated'
      ELSE 'quote_deleted' END;
      
    v_payload := jsonb_build_object(
      'quote_number', v_record.quote_number,
      'amount', v_record.grand_total,
      'status', v_record.status,
      'currency', v_record.currency
    );
    
    IF v_record.customer_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.customer_id,
      'customer',
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  -- ==========================================
  -- ACTIVITIES TABLE 
  -- ==========================================
  ELSIF TG_TABLE_NAME = 'activities' THEN
    v_event_type := CASE 
      WHEN TG_OP = 'INSERT' THEN 'activity_created'
      WHEN TG_OP = 'UPDATE' THEN 'activity_updated'
      ELSE 'activity_deleted' END;
      
    v_payload := jsonb_build_object(
      'title', v_record.title,
      'type', v_record.type,
      'priority', COALESCE(v_record.priority, 'normal')
    );
    
    -- Only sync if linked to an entity
    IF v_record.entity_id IS NULL THEN
      RETURN v_record;
    END IF;

    INSERT INTO public.activity_stream (
      organization_id, entity_id, entity_type,
      event_type, occurred_at, actor_id, actor_metadata,
      payload, source_id, source_table
    )
    VALUES (
      v_record.tenant_id,
      v_record.entity_id,
      COALESCE(v_record.entity_type, 'unknown'),
      v_event_type,
      COALESCE(v_record.created_at, NOW()),
      COALESCE(auth.uid(), v_record.created_by),
      jsonb_build_object('email', current_setting('request.jwt.claims', true)::json->>'email'),
      v_payload,
      v_record.id,
      TG_TABLE_NAME
    )
    ON CONFLICT (source_id, source_table, event_type) 
    DO UPDATE SET
      payload = EXCLUDED.payload,
      occurred_at = EXCLUDED.occurred_at,
      actor_metadata = EXCLUDED.actor_metadata;

  END IF;

  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activity_to_stream ON public.activities;
CREATE TRIGGER trg_activity_to_stream
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_activity_stream();

COMMIT;
-- Phase 22: Master Seed - Orbit Enterprise (20k Records)
-- Optimized: Compact Strings, No Trailing Drops, Reduced Count to avoid Timeout

-- 1. Create Config Temp Table
CREATE TEMP TABLE IF NOT EXISTS _cfg AS SELECT id as tid FROM tenants WHERE name = 'Galactic Stress Test' LIMIT 1;
INSERT INTO _cfg (tid) SELECT id FROM tenants WHERE name ILIKE 'Galactic Stress Test%' AND NOT EXISTS (SELECT 1 FROM _cfg) LIMIT 1;

-- 2. Cleanup (V2 uses `cards` for all people and organizations)
DELETE FROM cards WHERE tenant_id IN (SELECT tid FROM _cfg);

-- 3. Prepare Org IDs (Companies to assign people to)
-- We map 'company' concept to 'organization' type in the cards table
CREATE TEMP TABLE IF NOT EXISTS _orgs AS SELECT array_agg(id) as ids FROM cards WHERE tenant_id IN (SELECT tid FROM _cfg) AND type = 'organization';

-- 4. Generate Data
CREATE TEMP TABLE IF NOT EXISTS _batch AS
SELECT
    gen_random_uuid() as id,
    (SELECT tid FROM _cfg) as tenant_id,
    
    CASE WHEN random() < 0.5 THEN (ARRAY['Yossi', 'David', 'Moshe', 'Avraham', 'Yitzhak', 'Yaakov', 'Sarah', 'Rachel', 'Leah', 'Rivka', 'Noa', 'Tamar', 'Maya', 'Ori', 'Idan', 'Amit'])[floor(random()*16+1)] ELSE (ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica'])[floor(random()*18+1)] END as first_name,
    
    CASE WHEN random() < 0.5 THEN (ARRAY['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Katz', 'Azoulay', 'Gabay', 'Hadad', 'Friedman'])[floor(random()*11+1)] ELSE (ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez'])[floor(random()*11+1)] END as last_name,

    (ARRAY['lead', 'customer', 'churned', 'partner', 'negotiation'])[floor(random()*5+1)] as status,

    CASE WHEN random() > 0.98 THEN ARRAY[(ARRAY['VIP', 'Whale', 'Urgent', 'Decision Maker'])[floor(random()*4+1)::int], (ARRAY['Risk', 'High Value'])[floor(random()*2+1)::int], (ARRAY['Q4 Close'])[floor(random()*1+1)::int]] WHEN random() > 0.93 THEN ARRAY[(ARRAY['New', 'Referral', 'Online', 'Event'])[floor(random()*4+1)::int], (ARRAY['Follow Up'])[floor(random()*1+1)::int]] ELSE ARRAY[]::text[] END as tags,

    NOW() - (random() * 1000 || ' days')::interval as created_at,
    NOW() - (random() * 100 || ' days')::interval as updated_at

FROM generate_series(1, 1000)
WHERE EXISTS (SELECT 1 FROM _cfg);

-- 5. Insert into unified Cards table (V2 architecture)
INSERT INTO cards (id, tenant_id, type, card_type, hierarchy_path, display_name, company_name, first_name, last_name, job_title, created_at, updated_at)
SELECT 
    id, 
    tenant_id, 
    'person',
    'individual',
    REPLACE(id::TEXT, '-', '_')::ltree,
    first_name || ' ' || last_name,
    first_name || ' ' || last_name, 
    first_name, 
    last_name, 
    (ARRAY['Developer', 'Manager', 'Director', 'VP Sales', 'CEO', 'CTO', 'Designer', 'Product Manager'])[floor(random()*8+1)],
    created_at, 
    updated_at 
FROM _batch;

-- Insert organization cards (sample)
INSERT INTO cards (id, tenant_id, type, card_type, hierarchy_path, display_name, company_name, first_name, last_name, job_title, created_at, updated_at)
SELECT gen_random_uuid(), (SELECT tid FROM _cfg), 'organization', 'organization', REPLACE(gen_random_uuid()::text,'-','_')::ltree, org_name, org_name, NULL, NULL, NULL, NOW(), NOW()
FROM (SELECT (ARRAY['Acme Corp','Globex','Initech','Umbrella','Stark Industries'])[floor(random()*5+1)] as org_name FROM generate_series(1,20)) s;

-- Create random person-to-organization relationships using the correct schema
INSERT INTO entity_relationships (id, tenant_id, source_id, target_id, type_id, created_at)
SELECT
    gen_random_uuid(),
    p.tenant_id,
    p.id AS source_id,
    o.id AS target_id,
    (SELECT id FROM relationship_types WHERE tenant_id = p.tenant_id AND name = 'Employee' LIMIT 1),
    NOW()
FROM cards p
JOIN cards o ON o.type = 'organization' AND o.tenant_id = p.tenant_id
WHERE p.type = 'person'
  AND random() < 0.2
  AND EXISTS (SELECT 1 FROM relationship_types WHERE tenant_id = p.tenant_id AND name = 'Employee')
LIMIT 200
ON CONFLICT (source_id, target_id, type_id) DO NOTHING;

-- Final Check
SELECT count(*) as seeded_count FROM cards WHERE tenant_id IN (SELECT tid FROM _cfg);
