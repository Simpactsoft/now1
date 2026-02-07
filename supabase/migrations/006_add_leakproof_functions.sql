BEGIN;

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
    SELECT current_setting('app.current_tenant', true)::UUID;
$$;

DROP POLICY IF EXISTS cards_select ON cards;
CREATE POLICY cards_tenant_isolation_select ON cards
FOR SELECT TO authenticated
USING (tenant_id = get_current_tenant_id());

COMMIT;


