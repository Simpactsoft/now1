-- ============================================================================
-- RBAC: Audit Logging System
-- ============================================================================
-- Author: Based on Architect Research
-- Date: 2026-02-12
--
-- Creates comprehensive audit logging for CPQ changes:
-- - Partitioned table for performance
-- - BRIN indexes for chronological queries
-- - Automatic triggers on CPQ tables
-- - Admin-only access via RLS
-- ============================================================================

-- Create partitioned audit table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  target_table TEXT,
  target_id UUID,
  target_tenant_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create partition for current month
CREATE TABLE IF NOT EXISTS admin_audit_log_2026_02
PARTITION OF admin_audit_log
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Create partition for next month (auto-create script needed for production)
CREATE TABLE IF NOT EXISTS admin_audit_log_2026_03
PARTITION OF admin_audit_log
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- BRIN index: highly efficient for chronologically-ordered data
-- Uses ~1% space of B-tree with similar performance for time-range queries
CREATE INDEX IF NOT EXISTS idx_audit_created_brin 
ON admin_audit_log USING brin (created_at);

-- B-tree indexes for lookups
CREATE INDEX IF NOT EXISTS idx_audit_user 
ON admin_audit_log USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_table 
ON admin_audit_log USING btree (target_table);

CREATE INDEX IF NOT EXISTS idx_audit_tenant 
ON admin_audit_log USING btree (target_tenant_id);

-- ============================================================================
-- RLS: Only Admins Can View Audit
-- ============================================================================

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit"
ON admin_audit_log FOR SELECT
TO authenticated
USING ((SELECT is_admin()));

-- Service role can write (for triggers)
CREATE POLICY "service_role_writes_audit"
ON admin_audit_log FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- Audit Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_cpq_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_email TEXT;
  current_user_role TEXT;
BEGIN
  -- Get user info (cached within transaction)
  SELECT email INTO current_user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  SELECT get_app_role() INTO current_user_role;
  
  -- Insert audit record
  INSERT INTO admin_audit_log (
    user_id,
    user_email,
    user_role,
    action,
    target_table,
    target_id,
    target_tenant_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    current_user_email,
    current_user_role,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- Apply Triggers to Critical CPQ Tables
-- ============================================================================

-- Templates (critical - affects all configurations)
DROP TRIGGER IF EXISTS audit_templates ON cpq_product_templates;
CREATE TRIGGER audit_templates
AFTER INSERT OR UPDATE OR DELETE 
ON cpq_product_templates
FOR EACH ROW 
EXECUTE FUNCTION audit_cpq_changes();

-- Configuration Rules (affects validation)
DROP TRIGGER IF EXISTS audit_rules ON cpq_configuration_rules;
CREATE TRIGGER audit_rules
AFTER INSERT OR UPDATE OR DELETE 
ON cpq_configuration_rules
FOR EACH ROW 
EXECUTE FUNCTION audit_cpq_changes();

-- Options (affects pricing)
DROP TRIGGER IF EXISTS audit_options ON cpq_options;
CREATE TRIGGER audit_options
AFTER INSERT OR UPDATE OR DELETE 
ON cpq_options
FOR EACH ROW 
EXECUTE FUNCTION audit_cpq_changes();

-- Presets (user-facing)
DROP TRIGGER IF EXISTS audit_presets ON cpq_template_presets;
CREATE TRIGGER audit_presets
AFTER INSERT OR UPDATE OR DELETE 
ON cpq_template_presets
FOR EACH ROW 
EXECUTE FUNCTION audit_cpq_changes();

-- ============================================================================
-- Documentation & Utility Views
-- ============================================================================

COMMENT ON TABLE admin_audit_log IS 
'Audit trail for all CPQ changes. Partitioned by month for performance.
Only accessible to admin users via RLS.';

-- Useful query view
CREATE OR REPLACE VIEW recent_cpq_changes AS
SELECT 
  created_at,
  user_email,
  user_role,
  action,
  target_table,
  target_id,
  CASE 
    WHEN action = 'INSERT' THEN 'Created'
    WHEN action = 'UPDATE' THEN 'Modified'
    WHEN action = 'DELETE' THEN 'Deleted'
  END as change_type
FROM admin_audit_log
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;

COMMENT ON VIEW recent_cpq_changes IS 'Last 7 days of CPQ changes - admin only';
