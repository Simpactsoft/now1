BEGIN;

DROP POLICY IF EXISTS "view_relationships" ON entity_relationships;
DROP POLICY IF EXISTS "manage_relationships" ON entity_relationships;

CREATE POLICY entity_relationships_tenant_isolation_select 
ON entity_relationships FOR SELECT TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY entity_relationships_tenant_isolation_insert
ON entity_relationships FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::UUID
    AND EXISTS (SELECT 1 FROM cards WHERE id = source_id AND tenant_id = entity_relationships.tenant_id)
    AND EXISTS (SELECT 1 FROM cards WHERE id = target_id AND tenant_id = entity_relationships.tenant_id)
);

CREATE POLICY entity_relationships_tenant_isolation_update
ON entity_relationships FOR UPDATE TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::UUID)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY entity_relationships_tenant_isolation_delete
ON entity_relationships FOR DELETE TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

COMMIT;


