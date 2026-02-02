-- Migration: 252_audit_all_tables.sql
-- Description: List all tables in public schema with their row counts.
-- Helping locate the "hidden" 1.5M records.

CREATE OR REPLACE FUNCTION get_table_counts()
RETURNS TABLE (
    table_name text,
    row_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        RETURN QUERY EXECUTE format('SELECT %L::text, count(*) FROM %I', r.tablename, r.tablename);
    END LOOP;
END;
$$;

SELECT * FROM get_table_counts() ORDER BY row_count DESC;
