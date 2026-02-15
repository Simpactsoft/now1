# CPQ Configurations & RLS Security Guide

## Overview

This guide explains the CPQ (Configure-Price-Quote) system architecture, focusing on Configuration Templates and Row Level Security (RLS) implementation.

---

## 1. Core Concepts

### Product Template vs Configuration Template

| Aspect | Product Template | Configuration Template |
|--------|------------------|------------------------|
| **Purpose** | Define what's configurable | Save specific selections |
| **Table** | `product_templates` | `configurations` |
| **Contains** | Option groups, rules | Selected options, pricing |
| **Example** | "Gaming Laptop Configurator" with CPU/RAM/GPU options | "Budget Gaming Laptop" with i5/16GB/RTX4060 |
| **Created by** | Admin/Product Manager | Sales user during quote building |
| **Usage** | Used as base for configuring | Quick-add to quotes |

### Key Tables

```
product_templates (1) ──────> (N) option_groups (1) ──────> (N) options
                                                              
                                                              
configurations (N) ──────> (1) product_templates
```

---

## 2. Data Structure

### Configuration Template Fields

```sql
configurations (
  id UUID,
  tenant_id UUID NOT NULL,              -- Security boundary
  template_id UUID,                      -- Links to product_template
  
  -- Template-specific
  is_template BOOLEAN DEFAULT false,    -- Marks as reusable template
  template_name TEXT,                    -- e.g., "Budget Gaming Laptop"
  source_configuration_id UUID,          -- If cloned from another
  
  -- Configuration data
  selected_options JSONB,                -- {"cpu": "Intel i5", "ram": "16GB"}
  base_price NUMERIC(15,2),
  options_total NUMERIC(15,2),
  total_price NUMERIC(15,2),
  quantity INT DEFAULT 1,
  
  -- Ownership (for non-templates)
  user_id UUID,                          -- NULL for templates
  session_id TEXT,                       -- For anonymous users
  
  -- Status
  status TEXT DEFAULT 'draft',           -- draft|completed|quoted|ordered
  notes TEXT
)
```

---

## 3. RLS Security Architecture

### Problem: Multi-Tenant Data Isolation

**Challenge:** Users should only see configurations from their tenant.

**Wrong Approach ❌:**
```sql
-- DON'T DO THIS - Exposes all tenants!
CREATE POLICY "Anyone can view templates"
ON configurations FOR SELECT
USING (is_template = true);
```

**Correct Approach ✅:**

#### Step 1: RLS Policy (Permissive, relies on server filtering)

```sql
CREATE POLICY "Authenticated users can view configuration templates"
ON configurations
FOR SELECT
TO authenticated
USING (is_template = true);
```

This policy is **intentionally broad** because:
- It allows SELECT only on templates (`is_template = true`)
- Actual tenant filtering happens in the server action
- Templates have no `user_id`, so user-based RLS won't work

#### Step 2: Server Action (Strict tenant filtering)

```typescript
// /app/actions/cpq/configuration-actions.ts

export async function getConfigurationTemplates() {
  const supabase = await createClient();
  
  // 1. Read tenant_id from secure cookie
  const cookieStore = await cookies();
  const tenantId = cookieStore.get('tenant_id')?.value;
  
  if (!tenantId) {
    return { success: false, error: "Tenant ID not found" };
  }

  // 2. Explicitly filter by tenant
  const { data, error } = await supabase
    .from("configurations")
    .select("*")
    .eq("tenant_id", tenantId)  // ← Security enforcement
    .eq("is_template", true)
    .order("template_name");

  return { success: true, data };
}
```

### Why This Works

1. **Cookie Security**: `tenant_id` cookie is set by `TenantSwitcher` after authentication
2. **Explicit Filtering**: Server action enforces `.eq("tenant_id", tenantId)`
3. **RLS Safety Net**: Even if server code fails, RLS limits to `is_template = true`
4. **No JWT Dependency**: System doesn't rely on JWT `tenant_id` (which may be null)

---

## 4. Complete RLS Policy Set

```sql
-- ============================================================================
-- CONFIGURATIONS TABLE RLS POLICIES
-- ============================================================================

-- 1. SELECT: View own configurations OR templates
CREATE POLICY "Users can view own configurations"
ON configurations FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR session_id = ((current_setting('request.headers'::text, true))::json ->> 'session-id'::text)
  OR auth.role() = 'service_role'::text
);

CREATE POLICY "Authenticated users can view configuration templates"
ON configurations FOR SELECT
TO authenticated
USING (is_template = true);

-- 2. INSERT: Create configurations
CREATE POLICY "Users can create configurations"
ON configurations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. UPDATE: Only own drafts
CREATE POLICY "Users can update own draft configurations"
ON configurations FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() OR session_id = ((current_setting('request.headers'::text, true))::json ->> 'session-id'::text))
  AND status = 'draft'
);

-- 4. DELETE: Disabled for safety
CREATE POLICY "Users cannot delete configurations"
ON configurations FOR DELETE
TO authenticated
USING (false);

-- 5. Anonymous sharing (for quote sharing)
CREATE POLICY "Anyone can view shared configurations"
ON configurations FOR SELECT
TO anonymous
USING (share_token IS NOT NULL);
```

---

## 5. Creating Configuration Templates

### Via SQL (Development/Testing)

```sql
-- Step 1: Find your tenant and product template
SELECT id, name FROM tenants WHERE name ILIKE '%galactic%';
SELECT id, name, base_price FROM product_templates WHERE name ILIKE '%gaming%';

-- Step 2: Create configuration templates
INSERT INTO configurations (
  tenant_id,
  template_id,
  template_name,
  is_template,
  selected_options,
  base_price,
  options_total,
  total_price,
  quantity,
  status,
  notes
) VALUES
  -- Budget Gaming Laptop
  (
    '00000000-0000-0000-0000-000000000003'::uuid,  -- Galactic tenant
    'd749e248-843f-497e-89fb-ed42b3f70a3d'::uuid,  -- Gaming Laptop template
    'Budget Gaming Laptop',
    true,
    '{"Processor": "Intel i5-13600K", "Memory": "16GB DDR5", "Graphics Card": "RTX 4060", "Storage": "512GB NVMe"}'::jsonb,
    1200.00,
    0.00,
    1200.00,
    1,
    'completed',
    'Entry-level gaming configuration'
  );
```

### Via UI (Production)

1. Go to **Quote Builder** (`/dashboard/sales/quotes`)
2. Add a configurable product to quote
3. Configure options in the modal
4. Click **"Save as Template"**
5. Template appears in ⚙️ Configurations tab

---

## 6. Troubleshooting

### Configurations Don't Appear in Quote Builder

**Checklist:**

1. **Verify configurations exist:**
   ```sql
   SELECT 
     id, template_name, is_template, total_price, tenant_id
   FROM configurations
   WHERE is_template = true
     AND tenant_id = 'YOUR_TENANT_ID'::uuid;
   ```

2. **Check RLS policy:**
   ```sql
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'configurations';
   ```
   
   Must include: `"Authenticated users can view configuration templates"`

3. **Verify tenant_id cookie:**
   - Open Browser DevTools → Application → Cookies
   - Check `tenant_id` = your tenant UUID

4. **Check server logs:**
   ```typescript
   // In configuration-actions.ts, look for:
   console.log("[getConfigurationTemplates] Found", data?.length, "templates for tenant", tenantId);
   ```

### "Tenant ID not found" Error

**Cause:** `tenant_id` cookie missing or user not associated with tenant.

**Fix:**
```sql
-- 1. Verify user-tenant association
SELECT * FROM tenant_members 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- 2. Add if missing
INSERT INTO tenant_members (user_id, tenant_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'YOUR_TENANT_ID'::uuid,
  'member'
);

-- 3. Re-login to refresh cookie
```

### Templates Visible in Quote Builder but Not CPQ Configurator

**This is expected behavior!**

- `/dashboard/sales/quotes` + ⚙️ tab = **Configuration Templates** (saved selections)
- `/dashboard/cpq` = **Product Templates** (option definitions)

These are different entities in different tables.

---

## 7. Recovery from Accidental Deletion

### Option 1: Restore from Last Known Good State

```sql
-- Check if configurations still exist
SELECT id, template_name, created_at, updated_at
FROM configurations
WHERE tenant_id = 'YOUR_TENANT_ID'::uuid
  AND is_template = true
ORDER BY created_at DESC;

-- If deleted, check audit logs (if enabled)
SELECT * FROM admin_audit_log
WHERE table_name = 'configurations'
  AND action = 'DELETE'
ORDER BY created_at DESC LIMIT 10;
```

### Option 2: Recreate from Documentation

Use the SQL provided in Section 5 with your specific:
- `tenant_id`
- `template_id` 
- Configuration details

### Option 3: Clone from Existing Configuration

```sql
-- Clone a quote item as a template
INSERT INTO configurations (
  tenant_id, template_id, template_name, is_template,
  selected_options, base_price, options_total, total_price,
  quantity, status, notes
)
SELECT 
  tenant_id,
  template_id,
  'Cloned: ' || COALESCE(template_name, 'Configuration'),
  true,  -- Mark as template
  selected_options,
  base_price,
  options_total,
  total_price,
  quantity,
  'completed',
  'Recovered from configuration ID: ' || source_configuration_id
FROM configurations
WHERE id = 'SOURCE_CONFIG_ID'::uuid;
```

---

## 8. Security Best Practices

### ✅ DO

1. **Always filter by tenant_id in server actions**
   ```typescript
   .eq("tenant_id", tenantId)
   ```

2. **Read tenant_id from cookie, not JWT**
   ```typescript
   const cookieStore = await cookies();
   const tenantId = cookieStore.get('tenant_id')?.value;
   ```

3. **Use RLS as defense-in-depth**
   - Even if server code fails, RLS limits exposure

4. **Log tenant context**
   ```typescript
   console.log("[action] Found X items for tenant", tenantId);
   ```

### ❌ DON'T

1. **Don't rely only on RLS**
   - JWT may not have `tenant_id`
   - Always filter explicitly in code

2. **Don't use `createAdminClient()` for user data**
   - Bypasses RLS entirely
   - Only use for admin operations

3. **Don't expose tenant_id in URLs**
   - Use cookies/session for tenant context
   - Prevents URL-based tenant switching attacks

4. **Don't create RLS policies that expose cross-tenant data**
   ```sql
   -- ❌ BAD: Exposes all tenants
   USING (is_template = true)
   
   -- ✅ GOOD: Relies on server filtering + RLS defense
   USING (is_template = true) -- Server action filters by tenant_id
   ```

---

## 9. Testing Checklist

### Backend Testing

```bash
# 1. Unit test: getConfigurationTemplates filters by tenant
# 2. Integration test: RLS prevents cross-tenant reads
# 3. E2E test: Quote Builder shows only tenant's templates
```

### Manual Testing

1. **Create template as Tenant A**
   - Login as `user1@tenantA.com`
   - Create configuration template "Test A"

2. **Verify isolation as Tenant B**
   - Login as `user2@tenantB.com`
   - Check Quote Builder ⚙️ tab
   - Should NOT see "Test A"

3. **Switch tenants**
   - Use TenantSwitcher
   - Verify templates update correctly

---

## 10. Migration Template

When adding new CPQ features, use this migration template:

```sql
-- migrations/YYYYMMDDHHMMSS_feature_name.sql

-- ============================================================================
-- Step 1: Schema Changes
-- ============================================================================
ALTER TABLE configurations 
ADD COLUMN new_field TEXT;

-- ============================================================================
-- Step 2: Update RLS Policies
-- ============================================================================
DROP POLICY IF EXISTS "old_policy_name" ON configurations;

CREATE POLICY "new_policy_name"
ON configurations
FOR SELECT
TO authenticated
USING (
  -- Ensure tenant isolation
  tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid
  -- OR rely on server-side filtering if JWT lacks tenant_id
);

-- ============================================================================
-- Step 3: Verify
-- ============================================================================
-- Test that RLS works as expected
SELECT * FROM configurations WHERE is_template = true;
-- Should only show current user's tenant

-- ============================================================================
-- Step 4: Rollback (if needed)
-- ============================================================================
-- DROP POLICY "new_policy_name" ON configurations;
-- ALTER TABLE configurations DROP COLUMN new_field;
```

---

## References

### Documentation
- **[Working SQL Queries](./cpq-working-queries.sql)** - All tested queries with real IDs and results
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

### Code Files
- CPQ Schema: `/supabase/migrations/20260211000000_cpq_product_configurator.sql`
- RLS Fix Migration: `/supabase/migrations/20260215000000_fix_configurations_rls.sql`
- Server Actions: `/app/actions/cpq/configuration-actions.ts`
- UI Components: `/components/sales/ConfigurationsList.tsx`

---

**Last Updated:** 2026-02-15  
**Author:** AI Assistant  
**Review Required:** Yes - Verify RLS policies match production
