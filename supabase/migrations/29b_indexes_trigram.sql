-- Part B: Trigram Index (The Heavy one)
-- Runs on 1.6M rows. If this still times out, we might need to run it via the CLI/script.
CREATE INDEX IF NOT EXISTS trgm_idx_parties_display_name 
ON parties 
USING GIST (display_name gist_trgm_ops);
