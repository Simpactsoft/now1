-- Phase 20: Core CRM Fields (Parties Table Upgrade)
-- Enhances the base entity with lifecycle, responsibility, and segmentation data.

-- 1. Add Columns to Parties (Parent Table)
ALTER TABLE parties
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lead',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. Indexes for High-Performance Filtering
-- GIN Index for fast "Contains Tag" queries
CREATE INDEX IF NOT EXISTS idx_parties_tags ON parties USING GIN (tags);

-- B-Tree Index for "My Leads" queries
CREATE INDEX IF NOT EXISTS idx_parties_owner_id ON parties(owner_id);

-- B-Tree Index for Status filtering
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);

-- B-Tree Index for "Stale Leads" analysis
CREATE INDEX IF NOT EXISTS idx_parties_last_interaction ON parties(last_interaction_at);

-- 3. Notify Schema Cache
NOTIFY pgrst, 'reload config';
