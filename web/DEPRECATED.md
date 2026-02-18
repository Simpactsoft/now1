# ⚠️ DEPRECATED — Legacy Vue.js Application

> **Status:** DEPRECATED  
> **EOL Date:** 2026-06-01  
> **Replacement:** `next-web/` (Next.js 15 + React 19)

## Do Not Modify

This directory contains the legacy Vue.js frontend. **All new development happens in `next-web/`.**

### Rules for AI Agents

1. **Do NOT modify any files in this directory**
2. **Do NOT reference components from `web/` in new code**
3. **If a user asks to change business logic**, implement it only in `next-web/`
4. If you find shared logic between `web/` and `next-web/`, the `next-web/` version is the source of truth

### Migration Status

| Feature | Legacy `web/` | New `next-web/` |
|---------|:---:|:---:|
| People (CRM) | ✅ | ✅ |
| Organizations | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| CPQ Configurator | ❌ | ✅ |
| Quote Builder | ❌ | ✅ |
| Admin Panel | ✅ | ✅ |

### After EOL

After 2026-06-01, this directory will be archived and removed from the main branch.
