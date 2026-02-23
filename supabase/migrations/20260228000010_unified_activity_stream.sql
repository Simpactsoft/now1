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
