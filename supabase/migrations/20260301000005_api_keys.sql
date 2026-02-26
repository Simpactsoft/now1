-- Migration: 20260301000005_api_keys.sql
-- Description: Creates the API Keys table and authentication function for Public API access.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The associated user whose roles/permissions apply
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL, -- Hashed version of the key
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(api_key_hash);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own API keys"
    ON public.api_keys FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages API keys"
    ON public.api_keys FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION update_api_keys_updated_at();


-- 2. Authenticate API Key RPC
-- This function verifies the hashed key and returns the associated context.
-- Used by Edge Functions or Custom API endpoints to valid the key.
CREATE OR REPLACE FUNCTION authenticate_api_key(p_api_key TEXT)
RETURNS JSONB AS $$
DECLARE
    v_key_record RECORD;
    v_hashed_input TEXT;
BEGIN
    -- Hash the input key to compare with stored hash
    -- Assuming a simple SHA256 for this example, though bcript is better for passwords, 
    -- SHA256 is often used for high-entropy API keys.
    v_hashed_input := encode(digest(p_api_key, 'sha256'), 'hex');

    SELECT id, tenant_id, user_id, is_active, expires_at
    INTO v_key_record
    FROM public.api_keys
    WHERE api_key_hash = v_hashed_input
    LIMIT 1;

    -- Not found or inactive
    IF NOT FOUND OR v_key_record.is_active = false THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive API key');
    END IF;

    -- Expired
    IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'API key expired');
    END IF;

    -- Update last_used_at
    UPDATE public.api_keys 
    SET last_used_at = now() 
    WHERE id = v_key_record.id;

    -- Return valid context
    RETURN jsonb_build_object(
        'valid', true,
        'tenant_id', v_key_record.tenant_id,
        'user_id', v_key_record.user_id,
        'key_id', v_key_record.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
