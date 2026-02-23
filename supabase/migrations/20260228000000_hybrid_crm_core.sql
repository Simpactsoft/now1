-- Migration: 20260228000000_hybrid_crm_core.sql
-- Description: Implement missing tables and columns from the B2B/B2C CRM specification.
-- Adapts the schema to use the existing tenants/cards structure and RLS conventions.

BEGIN;

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
CREATE POLICY tenant_isolation_campaign_members ON campaign_members
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_leads ON leads
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_pipelines ON pipelines
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_pipeline_stages ON pipeline_stages
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_opportunities ON opportunities
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_opportunity_cards ON opportunity_cards
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

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
CREATE POLICY tenant_isolation_activities ON activities
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP TRIGGER IF EXISTS trg_activities_updated_at ON activities;
CREATE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================================
-- 11. Activity Links
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    card_id UUID,
    FOREIGN KEY (tenant_id, card_id) REFERENCES cards(tenant_id, id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'related' CHECK (link_type IN ('primary','related','mentioned')),
    CONSTRAINT chk_al_one_entity CHECK (
        (card_id IS NOT NULL)::int +
        (opportunity_id IS NOT NULL)::int +
        (lead_id IS NOT NULL)::int +
        (campaign_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_al_card ON activity_links (tenant_id, card_id, activity_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_opp ON activity_links (tenant_id, opportunity_id, activity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_lead ON activity_links (tenant_id, lead_id, activity_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_campaign ON activity_links (tenant_id, campaign_id, activity_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE activity_links ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY tenant_isolation_activity_inbox ON activity_inbox
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

COMMIT;
