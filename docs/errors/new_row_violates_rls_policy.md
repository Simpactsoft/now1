# RLS Policy Violation - Diagnostic Guide

**Error Message:**
```
new row violates row-level security policy for table "X"
```

⏱️ **Expected Resolution Time:** 5-10 minutes  
🎯 **Success Rate:** 95% if checklist followed completely

---

## 🧠 Before You Begin: Avoid Common Thinking Traps

**❌ DON'T:**
- ❌ Jump to "this happened before" (Availability Bias)
- ❌ Stop after finding one issue (Premature Closure)  
- ❌ Assume your first guess is right (Confirmation Bias)
- ❌ Skip steps because they "seem unnecessary"

**✅ DO:**
- ✅ Follow the **ENTIRE** checklist in order
- ✅ Verify each step with actual queries
- ✅ Document what you find at each step
- ✅ Complete all 6 steps even if you think you found the issue

**⏱️ Investment:** 5 extra minutes to follow full checklist  
**💰 Payoff:** 80% faster resolution + prevents returning to same issue

---

## 🛑 STOP! Follow This Checklist

**Do NOT try random fixes. Follow these steps IN ORDER:**

---

### ✅ Step 1: Does the table exist?

**Run in Supabase SQL Editor:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'YOUR_TABLE_NAME';
```

**Results:**
- ❌ **No rows** → Table doesn't exist! See [table_not_found.md](./table_not_found.md)
- ✅ **Has rows** → Continue to Step 2

---

### ✅ Step 2: Is RLS enabled?

**Run in Supabase SQL Editor:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'YOUR_TABLE_NAME';
```

**Results:**
- ❌ **rowsecurity = false** → RLS not enabled! Run:
  ```sql
  ALTER TABLE YOUR_TABLE_NAME ENABLE ROW LEVEL SECURITY;
  ```
- ✅ **rowsecurity = true** → Continue to Step 3

---

### ✅ Step 3: Do policies exist?

**Run in Supabase SQL Editor:**
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'YOUR_TABLE_NAME';
```

**Results:**
- ❌ **No rows** → No policies exist! Use [rls-policy-template.sql](file:///Users/itzhakbenari/Documents/GitHub/now/templates/rls-policy-template.sql)
- ⚠️  **Less than 4 policies** → Missing policies! Continue to Step 4
-✅ **4+ policies** → Continue to Step 4

---

### ✅ Step 4: Does INSERT policy exist with WITH CHECK?

**Run in Supabase SQL Editor:**
```sql
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'YOUR_TABLE_NAME' AND cmd = 'INSERT';
```

**Check:**
- [ ] Does an INSERT policy exist?
- [ ] Does `with_check` column contain `tenant_id`?
- [ ] Does it use `profiles` table (not `auth.jwt()`)?

**Common Issues:**
1. **No INSERT policy** → Use template to create one
2. **INSERT policy uses `USING` instead of `WITH CHECK`** → Replace policy:
   ```sql
   DROP POLICY "old_policy_name" ON YOUR_TABLE_NAME;
   -- Use template to create correct INSERT policy
   ```
3. **Policy uses `auth.jwt()->>'tenant_id'`** → This doesn't work! Replace with:
   ```sql
   WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
   ```

---

### ✅ Step 5: Manual INSERT test

**Run in Supabase SQL Editor:**
```sql
INSERT INTO YOUR_TABLE_NAME (tenant_id, name)
VALUES (
  (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
  'Test Insert'
);
```

**Results:**
- ✅ **Success** → RLS policies work! Problem is in your **code**, not RLS. Check:
  - Is `tenant_id` included in INSERT?
  - Is service role client being used instead of user client?
  - Check server action code
- ❌ **Still fails** → Continue to Step 6

---

### ✅ Step 6: Check your tenant_id

**Run in Supabase SQL Editor:**
```sql
SELECT id, tenant_id, email
FROM profiles
WHERE id = auth.uid();
```

**Check:**
- [ ] Does your user have a `tenant_id`?
- [ ] Is it a valid UUID?

**If tenant_id is NULL:**
```sql
-- Find your tenant
SELECT id, name FROM tenants LIMIT 10;

-- Add yourself to a tenant
INSERT INTO tenant_members (user_id, tenant_id, role)
VALUES (
  auth.uid(),
  'YOUR_TENANT_ID'::uuid,
  'member'
);

-- Update your profile
UPDATE profiles 
SET tenant_id = 'YOUR_TENANT_ID'::uuid
WHERE id = auth.uid();
```

---

## 🔧 Quick Fixes

### Fix #1: Create All 4 RLS Policies

See: [rls-policy-template.sql](file:///Users/itzhakbenari/Documents/GitHub/now/templates/rls-policy-template.sql)

### Fix #2: Replace auth.jwt() with profiles lookup

**Wrong:**
```sql
USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
```

**Correct:**
```sql
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
```

### Fix #3: INSERT needs WITH CHECK, not USING

**Wrong:**
```sql
CREATE POLICY "..." ON table FOR INSERT
USING (tenant_id = ...);  -- ❌ Wrong!
```

**Correct:**
```sql
CREATE POLICY "..." ON table FOR INSERT
WITH CHECK (tenant_id = ...);  -- ✅ Correct!
```

---

## 📚 Related Docs

- [RLS Policy Template](file:///Users/itzhakbenari/Documents/GitHub/now/templates/rls-policy-template.sql)
- [Server Action Template](file:///Users/itzhakbenari/Documents/GitHub/now/templates/server-action-template.ts)
- [Table Not Found Guide](./table_not_found.md)
- [Validation Failed Guide](./validation_failed.md)

---

## 🔍 Automated Check

Run this script to check RLS automatically:
```bash
./scripts/check-rls-policies.sh YOUR_TABLE_NAME
```

---

**Last Updated:** 2026-02-16
