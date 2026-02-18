-- Add source_snapshot JSONB to configurations table
-- Captures the state of the source template/configuration at clone time
-- This enables future lineage tracking: "what did the template look like when this config was created?"

ALTER TABLE configurations
    ADD COLUMN IF NOT EXISTS source_snapshot JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN configurations.source_snapshot IS 
    'Snapshot of the source configuration/template state at clone time. '
    'Stores: template name, option groups with options, prices, and rules. '
    'Immutable after creation — allows historical comparison.';
