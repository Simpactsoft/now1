-- Add completed_at back to activities for frontend compatibility
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
