# Supabase Scripts

This directory contains **manual administrative scripts** that should NOT be run automatically as migrations.

## ⚠️ Important Notes

- These are **NOT migrations** - they contain environment-specific data
- **Always replace placeholder values** before running
- Run these manually in Supabase Dashboard SQL Editor
- Never commit scripts with real credentials

## Scripts

### `setup_admin.sql`
Create an admin user from an existing auth user.

**Before running:** Replace `YOUR_ADMIN_EMAIL` with the actual email.

### `change_admin_to_sales.sql`
Transfer admin role from one user to another.

**Before running:** Replace `OLD_ADMIN_EMAIL` and `NEW_ADMIN_EMAIL`.

### `check_hook.sql`
Verify the custom access token hook is working correctly.

### Deprecated Scripts

- `DEPRECATED_rbac_complete.sql` - Use numbered migrations instead
- `DEPRECATED_rbac_continue.sql` - Use numbered migrations instead

These files are kept for reference only. **Use the numbered migrations** in `supabase/migrations/` instead.
