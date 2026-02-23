-- Migration to fix duplicate get_bom_tree RPC functions

BEGIN;

-- Drop the older function that uses character varying/varchar
DROP FUNCTION IF EXISTS get_bom_tree(p_product_id UUID, p_version VARCHAR);
DROP FUNCTION IF EXISTS calculate_bom_cost(p_product_id UUID, p_version VARCHAR);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
