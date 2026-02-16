# Error Resolution Guides

This directory contains step-by-step diagnostic guides for common errors.

**🎯 How to use:**
1. When you get an error, find the matching guide below
2. Follow the checklist IN ORDER
3. Don't skip steps!

---

## 📋 Error Guides

### Database & RLS Errors

- **[new row violates row-level security policy](./new_row_violates_rls_policy.md)**
  - Symptoms: `new row violates row-level security policy for table "X"`
  - Common causes: Missing policies, wrong policy type, table doesn't exist
  - Time to fix: 10-30 min with checklist

### Validation Errors

- **[Validation failed](./validation_failed.md)**
  - Symptoms: `Validation failed`, Zod errors
  - Common causes: `.default()` vs `.optional()`, `null` vs `undefined`, missing fields
  - Time to fix: 5-15 min with checklist

### Authentication Errors

- **[Tenant ID not found](./tenant_id_not_found.md)** (Coming soon)
  - Symptoms: `Tenant ID not found`, `Tenant ID required`
  - Common causes: Missing profiles lookup, wrong metadata key
  - Time to fix: 5 min with checklist

---

## 🛠️ Quick Tools

### Diagnostic Scripts

```bash
# Check RLS policies for a table
./scripts/check-rls-policies.sh <table_name>
```

### Code Templates

- [Server Action with Tenant ID](file:///Users/itzhakbenari/Documents/GitHub/now/templates/server-action-template.ts)
- [RLS Policy SQL Template](file:///Users/itzhakbenari/Documents/GitHub/now/templates/rls-policy-template.sql)

---

## 💡 Philosophy

These guides follow a **diagnostic checklist approach**:

1. ✅ **Error-first naming** - Guide name = exact error message
2. ✅ **Step-by-step** - Follow sequentially, don't skip
3. ✅ **Copy-paste solutions** - Quick fixes you can use immediately
4. ✅ **Root cause explanation** - Understand WHY it failed

**Don't:**
- ❌ Try random fixes
- ❌ Skip diagnostic steps
- ❌ Assume you know the cause

**Do:**
- ✅ Follow the checklist
- ✅ Run verification queries
- ✅ Use the templates

---

## 📊 Success Metrics

**Before these guides:**
- Average resolution time: 2-3 hours
- Repeat occurrences: High (same issue multiple times)

**After these guides:**
- Target resolution time: 10-30 min
- Repeat occurrences: Low (fixed correctly first time)

---

## 🔄 Continuous Improvement

When you encounter a **new recurring error**:
1. Document it following the same pattern
2. Add a checklist
3. Include copy-paste fixes
4. Link to templates

**Last Updated:** 2026-02-16
