-- Part C: Composite Indexes & Analyze (Medium)
CREATE INDEX IF NOT EXISTS idx_parties_tenant_created_at 
ON parties (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parties_tenant_updated_at 
ON parties (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_party_memberships_org_role 
ON party_memberships (organization_id, role_name);

ANALYZE parties;
ANALYZE people;
ANALYZE party_memberships;
