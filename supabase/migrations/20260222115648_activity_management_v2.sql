-- =============================================================================
-- ACTIVITY MANAGEMENT ENGINE — PostgreSQL Schema for Multi-Tenant SaaS CRM
-- Supabase-native with Row-Level Security
-- Version: Ultimate 6-Table Architecture 
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ENUMS
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('task', 'meeting', 'email', 'call', 'note', 'whatsapp', 'sms');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE activity_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE participant_type AS ENUM ('user', 'contact', 'card', 'lead');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE participant_role AS ENUM (
        'initiator', 'assignee', 'viewer',
        'email_to', 'email_cc', 'email_bcc',
        'required', 'optional'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE link_type AS ENUM ('follow_up', 'reply', 'related', 'parent_child', 'automated_sequence');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sync_provider AS ENUM ('google', 'microsoft');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('synced', 'pending_push', 'pending_pull', 'error', 'conflict');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =============================================================================
-- 2. STATUS DEFINITIONS (Configurable Workflow per Tenant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_status_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    activity_type   activity_type NOT NULL,
    status_name     VARCHAR(100) NOT NULL,
    status_order    SMALLINT NOT NULL DEFAULT 0,
    color           VARCHAR(7),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed_state BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_color_hex CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- We don't enforce unique constraints stringently if it causes conflict on IF NOT EXISTS, 
-- but we should add uniqueness guarantees.
DROP INDEX IF EXISTS uq_status_per_tenant_type;
CREATE UNIQUE INDEX uq_status_per_tenant_type ON public.activity_status_definitions (tenant_id, activity_type, status_name);

DROP INDEX IF EXISTS uq_one_default_status;
CREATE UNIQUE INDEX uq_one_default_status ON public.activity_status_definitions (tenant_id, activity_type) WHERE is_default = TRUE;


-- =============================================================================
-- 3. ACTIVITIES (STI CORE TABLE)
-- Since `activities` already exists from MVP, we ALTER it completely:
-- =============================================================================
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS title VARCHAR(500),
    ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.activity_status_definitions(id),
    ADD COLUMN IF NOT EXISTS priority activity_priority NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS location VARCHAR(500),
    ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS thread_id UUID,
    ADD COLUMN IF NOT EXISTS message_id VARCHAR(500),
    ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(500),
    ADD COLUMN IF NOT EXISTS email_references TEXT,
    ADD COLUMN IF NOT EXISTS parent_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS entity_id UUID,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Some cleanup on preexisting simple columns:
-- If there's an old 'status' TEXT column, we can leave it for backward compat or drop it.
-- We'll leave it out of this script to avoid dropping user data, but rely on status_id going forward.


-- =============================================================================
-- 4. ACTIVITY PARTICIPANTS (M:N Roles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_participants_v2 (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    activity_id         UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    participant_type    participant_type NOT NULL,
    participant_id      UUID NOT NULL,
    role                participant_role NOT NULL,
    rsvp_status         VARCHAR(20) DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: using activity_participants_v2 table name to prevent clash with my previous run today.
DROP INDEX IF EXISTS uq_participant_per_activity;
CREATE UNIQUE INDEX uq_participant_per_activity ON public.activity_participants_v2 (activity_id, participant_type, participant_id, role);


-- =============================================================================
-- 5. STATUS HISTORY (Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_status_history_v2 (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,
    activity_id     UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    old_status_id   UUID REFERENCES public.activity_status_definitions(id),
    new_status_id   UUID NOT NULL REFERENCES public.activity_status_definitions(id),
    changed_by      UUID NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT,

    CONSTRAINT chk_status_different CHECK (old_status_id IS NULL OR old_status_id != new_status_id)
);


-- =============================================================================
-- 6. ACTIVITY LINKS (For Sub tasks/Chaining not handled by parent_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_links_v3 (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id             UUID NOT NULL,
    source_activity_id    UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    target_activity_id    UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    link_type             link_type NOT NULL,
    created_by            UUID,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_no_self_link CHECK (source_activity_id != target_activity_id)
);
DROP INDEX IF EXISTS uq_activity_link;
CREATE UNIQUE INDEX uq_activity_link ON public.activity_links_v3 (source_activity_id, target_activity_id, link_type);


-- =============================================================================
-- 7. SYNC METADATA (External Calendar/Email Isolation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_sync_metadata (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL,
    activity_id         UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    provider            sync_provider NOT NULL,
    external_id         VARCHAR(1024) NOT NULL,
    sync_token          TEXT,
    calendar_id         VARCHAR(500),
    color_id            VARCHAR(20),       -- Google colorId (1-11) or MS category
    ical_uid            VARCHAR(500),      -- iCalendar UID for cross-platform dedup
    etag                VARCHAR(500),      -- ETag for conflict detection
    last_synced_at      TIMESTAMPTZ,
    sync_status         sync_status NOT NULL DEFAULT 'pending_push',
    sync_error          TEXT,
    raw_metadata        JSONB DEFAULT '{}'::JSONB
);

DROP INDEX IF EXISTS uq_sync_per_provider;
CREATE UNIQUE INDEX uq_sync_per_provider ON public.activity_sync_metadata (activity_id, provider);
DROP INDEX IF EXISTS uq_sync_external_id;
CREATE UNIQUE INDEX uq_sync_external_id ON public.activity_sync_metadata (tenant_id, provider, calendar_id, external_id);


-- =============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_activities_tenant_type ON public.activities(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_status ON public.activities(tenant_id, status_id);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(tenant_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_start_time ON public.activities(tenant_id, start_time) WHERE start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_thread_id ON public.activities(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_parent_id ON public.activities(parent_activity_id) WHERE parent_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_entity ON public.activities(tenant_id, entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_message_id ON public.activities(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(tenant_id, created_at DESC);

-- Participants
CREATE INDEX IF NOT EXISTS idx_participants_activity ON public.activity_participants_v2(activity_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.activity_participants_v2(tenant_id, participant_type, participant_id);
CREATE INDEX IF NOT EXISTS idx_participants_role ON public.activity_participants_v2(activity_id, role);

-- Links
CREATE INDEX IF NOT EXISTS idx_links_source ON public.activity_links_v3(source_activity_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON public.activity_links_v3(target_activity_id);


-- =============================================================================
-- 9. ROW LEVEL SECURITY
-- Using the 0-subquery JSON trick (assuming get_current_tenant_id() wrapper exists)
-- =============================================================================
ALTER TABLE public.activity_status_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_status_history_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_links_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sync_metadata ENABLE ROW LEVEL SECURITY;

-- Note: to be fully resilient, relying on the get_current_tenant_id() currently available in the database.
CREATE POLICY "Tenant isolation for Activity Statuses" ON public.activity_status_definitions FOR ALL 
USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation for Activity Participants" ON public.activity_participants_v2 FOR ALL 
USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Append-only isolation for Status History" ON public.activity_status_history_v2 FOR INSERT 
WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Read isolation for Status History" ON public.activity_status_history_v2 FOR SELECT 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation for Activity Links" ON public.activity_links_v3 FOR ALL 
USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Tenant isolation for Sync Metadata" ON public.activity_sync_metadata FOR ALL 
USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_activity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activities_updated_at ON public.activities;
CREATE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION update_activity_timestamp();

CREATE OR REPLACE FUNCTION log_activity_status_change_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
        INSERT INTO public.activity_status_history_v2 (
            tenant_id, activity_id, old_status_id, new_status_id, changed_by, changed_at
        )
        VALUES (
            NEW.tenant_id,
            NEW.id,
            OLD.status_id,
            NEW.status_id,
            auth.uid(),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_activity_status_log_v2 ON public.activities;
CREATE TRIGGER trg_activity_status_log_v2
    AFTER UPDATE OF status_id ON public.activities
    FOR EACH ROW EXECUTE FUNCTION log_activity_status_change_v2();
