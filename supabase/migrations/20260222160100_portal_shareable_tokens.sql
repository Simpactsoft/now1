-- Migration: Portal Shareable Tokens
-- Description: Creates the portal_tokens table to securely map shareable URLs back to CRM entities without relying on email-based auth.

CREATE TABLE IF NOT EXISTS public.portal_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash text NOT NULL UNIQUE, -- The generated secure string (e.g. crypto.randomBytes(32))
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    card_id uuid NOT NULL, -- The CRM customer
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- The agent who generated it
    expires_at timestamptz NOT NULL, -- Expiration date (e.g. 7-14 days)
    created_at timestamptz DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    FOREIGN KEY (tenant_id, card_id) REFERENCES public.cards(tenant_id, id) ON DELETE CASCADE
);

-- Indexes for fast lookup by token and by card
CREATE INDEX IF NOT EXISTS idx_portal_tokens_hash ON public.portal_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_card_id ON public.portal_tokens(card_id);

-- Enable RLS
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

-- 1. Agents can generate tokens for cards within their tenant
CREATE POLICY "Tenant members can create portal tokens"
    ON public.portal_tokens FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = portal_tokens.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- 2. Agents can view tokens for cards within their tenant
CREATE POLICY "Tenant members can view portal tokens"
    ON public.portal_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = portal_tokens.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- 3. Agents can delete tokens (revoke access manually)
CREATE POLICY "Tenant members can revoke portal tokens"
    ON public.portal_tokens FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = portal_tokens.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- 4. Portal users use the NEXT JS Server Actions (Service Role Client) 
--    to validate these tokens, bypassing RLS during the login phase.
