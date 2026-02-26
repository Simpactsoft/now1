-- Migration: Import System Foundation
-- Description: Phase 1 of the Import System. Adds tables, extensions, and core RPCs.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 2. Indexes for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_cards_display_name_trgm ON cards USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_email_trgm ON cards USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_phone ON cards (tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_type_tenant ON cards (tenant_id, type);

-- 3. Tables
CREATE TABLE IF NOT EXISTS import_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    import_type     TEXT NOT NULL,
    duplicate_policy TEXT NOT NULL DEFAULT 'skip',
    file_name       TEXT,
    total_rows      INT DEFAULT 0,
    processed_rows  INT DEFAULT 0,
    created_count   INT DEFAULT 0,
    updated_count   INT DEFAULT 0,
    skipped_count   INT DEFAULT 0,
    error_count     INT DEFAULT 0,
    column_mapping  JSONB,
    settings        JSONB DEFAULT '{}',
    error_summary   JSONB DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON import_jobs
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::uuid));

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(tenant_id, status);

CREATE TABLE IF NOT EXISTS import_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL,
    row_number  INT NOT NULL,
    status      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   UUID,
    duplicate_of UUID,
    raw_data    JSONB,
    error_message TEXT,
    error_details JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON import_logs
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::uuid));

CREATE INDEX IF NOT EXISTS idx_import_logs_job ON import_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(job_id, status);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    job_id          UUID REFERENCES import_jobs(id),
    entity_type     TEXT NOT NULL,
    existing_id     UUID NOT NULL,
    FOREIGN KEY (tenant_id, existing_id) REFERENCES cards(tenant_id, id),
    match_score     NUMERIC(5,4),
    match_fields    JSONB,
    incoming_data   JSONB NOT NULL,
    resolution      TEXT DEFAULT 'pending',
    resolved_by     UUID,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON duplicate_candidates
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::uuid));

CREATE INDEX IF NOT EXISTS idx_dup_candidates_pending ON duplicate_candidates(tenant_id, resolution)
    WHERE resolution = 'pending';

-- 4. Core RPCs

CREATE OR REPLACE FUNCTION normalize_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    RETURN regexp_replace(p_phone, '[^0-9+]', '', 'g');
END;
$$;

CREATE OR REPLACE FUNCTION find_duplicates(
    p_entity_type   TEXT,
    p_email         TEXT DEFAULT NULL,
    p_phone         TEXT DEFAULT NULL,
    p_first_name    TEXT DEFAULT NULL,
    p_last_name     TEXT DEFAULT NULL,
    p_display_name  TEXT DEFAULT NULL,
    p_tax_id        TEXT DEFAULT NULL,
    p_threshold     NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
    card_id         UUID,
    display_name    TEXT,
    email           TEXT,
    phone           TEXT,
    match_type      TEXT,
    match_score     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := (SELECT current_setting('app.current_tenant_id')::uuid);

    RETURN QUERY
    
    -- 1. Exact email match (highest priority)
    SELECT c.id, c.display_name, c.email, c.phone,
           'exact_email'::TEXT as match_type,
           1.0::NUMERIC as match_score
    FROM cards c
    WHERE c.tenant_id = v_tenant_id
      AND c.type = p_entity_type
      AND p_email IS NOT NULL AND p_email != ''
      AND LOWER(TRIM(c.email)) = LOWER(TRIM(p_email))

    UNION ALL

    -- 2. Exact phone match
    SELECT c.id, c.display_name, c.email, c.phone,
           'exact_phone'::TEXT,
           0.95::NUMERIC
    FROM cards c
    WHERE c.tenant_id = v_tenant_id
      AND c.type = p_entity_type
      AND p_phone IS NOT NULL AND p_phone != ''
      AND normalize_phone(c.phone) = normalize_phone(p_phone)

    UNION ALL

    -- 3. Exact tax_id match (organizations only)
    SELECT c.id, c.display_name, c.email, c.phone,
           'exact_tax_id'::TEXT,
           1.0::NUMERIC
    FROM cards c
    WHERE c.tenant_id = v_tenant_id
      AND c.type = 'organization'
      AND p_entity_type = 'organization'
      AND p_tax_id IS NOT NULL AND p_tax_id != ''
      AND c.custom_fields->>'tax_id' = p_tax_id

    UNION ALL

    -- 4. Fuzzy name match (using pg_trgm)
    SELECT c.id, c.display_name, c.email, c.phone,
           'fuzzy_name'::TEXT,
           CASE
               WHEN p_entity_type = 'person' THEN
                   similarity(
                       LOWER(c.display_name),
                       LOWER(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''))
                   )
               ELSE
                   similarity(LOWER(c.display_name), LOWER(COALESCE(p_display_name, '')))
           END::NUMERIC
    FROM cards c
    WHERE c.tenant_id = v_tenant_id
      AND c.type = p_entity_type
      AND (
          CASE
              WHEN p_entity_type = 'person' THEN
                  similarity(
                      LOWER(c.display_name),
                      LOWER(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''))
                  ) >= p_threshold
              ELSE
                  similarity(
                      LOWER(c.display_name),
                      LOWER(COALESCE(p_display_name, ''))
                  ) >= p_threshold
          END
      )

    ORDER BY match_score DESC
    LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION batch_import_cards(
    p_records       JSONB,
    p_import_job_id UUID,
    p_duplicate_policy TEXT DEFAULT 'skip'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_record    JSONB;
    v_result    JSONB := '[]'::JSONB;
    v_created   INT := 0;
    v_updated   INT := 0;
    v_skipped   INT := 0;
    v_errors    INT := 0;
BEGIN
    v_tenant_id := (SELECT current_setting('app.current_tenant_id')::uuid);

    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- Placeholder for logic
            NULL; 
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'created', v_created,
        'updated', v_updated,
        'skipped', v_skipped,
        'errors', v_errors
    );
END;
$$;
