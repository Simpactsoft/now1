-- --------------------------------------------------------------------------------
-- Unified Activity Stream Backfill Script
-- --------------------------------------------------------------------------------
-- Purpose: Populates the activity_stream table with existing quotes and activities
--          since the table triggers only apply to new updates/inserts.

-- 1. Backfill Quotes
INSERT INTO public.activity_stream (
  organization_id, entity_id, entity_type,
  event_type, occurred_at, actor_id, actor_metadata,
  payload, source_id, source_table
)
SELECT 
  tenant_id,
  customer_id,
  'customer',
  'quote_created',
  COALESCE(created_at, NOW()),
  created_by,
  jsonb_build_object('name', 'System (Backfill)'),
  jsonb_build_object(
    'quote_number', quote_number,
    'amount', grand_total,
    'status', status,
    'currency', currency
  ),
  id,
  'quotes'
FROM public.quotes
WHERE customer_id IS NOT NULL
ON CONFLICT (source_id, source_table, event_type) DO NOTHING;

-- 2. Backfill Activities
INSERT INTO public.activity_stream (
  organization_id, entity_id, entity_type,
  event_type, occurred_at, actor_id, actor_metadata,
  payload, source_id, source_table
)
SELECT 
  tenant_id,
  entity_id,
  COALESCE(entity_type, 'unknown'),
  'activity_created',
  COALESCE(created_at, NOW()),
  created_by,
  jsonb_build_object('name', 'System (Backfill)'),
  jsonb_build_object(
    'title', title,
    'type', type,
    'priority', priority
  ),
  id,
  'activities'
FROM public.activities
WHERE entity_id IS NOT NULL
ON CONFLICT (source_id, source_table, event_type) DO NOTHING;
