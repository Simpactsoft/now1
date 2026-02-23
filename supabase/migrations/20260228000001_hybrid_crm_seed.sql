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
