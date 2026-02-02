-- Migration: 250_debug_data_counts.sql
-- Description: Diagnostic tool to find where the 1.5M records are hidden.
-- Returns count of cards grouped by tenant_id.

CREATE OR REPLACE FUNCTION get_global_counts()
RETURNS TABLE (
    tenant_id uuid,
    count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT c.tenant_id, count(*)
    FROM cards c
    GROUP BY c.tenant_id
    ORDER BY count(*) DESC;
END;
$$;
