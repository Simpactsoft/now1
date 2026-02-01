
-- Migration: 207_seed_person_status.sql
-- Description: Seeds the initial 'PERSON_STATUS' option set and values if they don't exist.

BEGIN;

DO $$
DECLARE
    v_set_id uuid;
BEGIN
    -- 1. Create Option Set 'PERSON_STATUS' (Global)
    INSERT INTO public.option_sets (code, description, tenant_id)
    VALUES ('PERSON_STATUS', 'Status lifecycle of a person', NULL)
    ON CONFLICT (tenant_id, code) DO NOTHING
    RETURNING id INTO v_set_id;

    -- If no ID returned (already existed), fetch it
    IF v_set_id IS NULL THEN
        SELECT id INTO v_set_id FROM public.option_sets WHERE code = 'PERSON_STATUS' AND tenant_id IS NULL;
    END IF;

    -- 2. Insert Values (Lead, Customer, Churned)
    
    -- Lead
    INSERT INTO public.option_values (option_set_id, tenant_id, internal_code, label_i18n, color, sort_order)
    VALUES (
        v_set_id, 
        NULL, -- Global
        'Lead', -- internal code matches existing DB values 'Lead'
        '{"en": "Lead", "he": "ליד"}'::jsonb,
        '#6366f1', -- Indigo
        10
    )
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;

    -- Customer
    INSERT INTO public.option_values (option_set_id, tenant_id, internal_code, label_i18n, color, sort_order)
    VALUES (
        v_set_id, 
        NULL, 
        'Customer', -- Matches 'Customer'
        '{"en": "Customer", "he": "לקוח"}'::jsonb,
        '#10b981', -- Emerald
        20
    )
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;

    -- Churned
    INSERT INTO public.option_values (option_set_id, tenant_id, internal_code, label_i18n, color, sort_order)
    VALUES (
        v_set_id, 
        NULL, 
        'Churned', -- Matches 'Churned'
        '{"en": "Churned", "he": "נטש"}'::jsonb,
        '#ef4444', -- Red
        30
    )
    ON CONFLICT (option_set_id, tenant_id, internal_code) DO NOTHING;

END $$;

COMMIT;
