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
