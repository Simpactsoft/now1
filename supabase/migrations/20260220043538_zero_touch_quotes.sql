-- Migration: Zero-Touch Quotes (Digital Signatures)
-- Description: Adds fields needed a public, secure Web View of quotes.

-- 1. Add fields to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_by_ip TEXT;

-- 2. Create index on public_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token);

-- NOTE: We are NOT opening the bucket or table to the 'anon' role.
-- RLS remains strict. All public quote access will be routed through
-- Next.js Server Actions using the adminClient. This ensures security
-- while allowing the public_token to act as the authentication key.
