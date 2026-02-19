# Agent Instructions — NOW System

## Project Overview

NOW is a multi-tenant CRM + CPQ platform.

| Layer | Stack | Directory |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 | `next-web/` |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) | `supabase/` |
| Testing | Vitest (80+ unit tests) | `next-web/src/test/` |
| Styling | Tailwind CSS v4 + shadcn/ui | `next-web/src/components/ui/` |
| Legacy | Vue.js — **DEPRECATED, never modify** | `web/` |

---

## Critical Rules

### 1. Never Touch Legacy `web/`
The `web/` directory is deprecated. All development happens in `next-web/`.

### 2. Every New Table Must Have RLS Policies
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON my_table
  USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::uuid));
```

### 3. Every Server Action Must Use Zod Validation
```typescript
"use server";
import { z } from "zod";
import { mySchema } from "@/lib/schemas/my-schema";

export async function myAction(input: unknown): Promise<ActionResult<MyType>> {
    const parsed = mySchema.safeParse(input);
    if (!parsed.success) {
        return actionError(parsed.error.errors[0].message, "VALIDATION_ERROR");
    }
    // ... business logic
}
```

### 4. Use `ActionResult<T>` for All Server Action Return Types
```typescript
import { ActionResult, actionSuccess, actionError, actionOk } from "@/lib/action-result";

// Success with data:
return actionSuccess(data);

// Success without data (delete/update):
return actionOk();

// Error:
return actionError("Something went wrong", "NOT_FOUND");
```

Exception: Grid/fetch actions use `GridResult<T>` for AG Grid compatibility.

### 5. Use `useAction()` Hook for Client-Side Action Calls
Never call server actions directly in event handlers. Always wrap with `useAction()`:
```typescript
// ✅ Correct
const { execute, loading, error, data, retry } = useAction(createTemplate);
const handleSubmit = () => execute(formData);

// ❌ Wrong — no loading/error handling
const handleSubmit = async () => { await createTemplate(formData); };
```

---

## File Structure

```
next-web/src/
├── app/
│   ├── actions/              # Server actions (one file per domain)
│   │   ├── cpq/              # CPQ-specific actions
│   │   └── *.ts              # CRM actions (people, orgs, products, quotes)
│   └── dashboard/            # Page routes
│       ├── people/           # People list + [id] profile
│       ├── organizations/    # Orgs list + [id] profile
│       ├── products/         # Products list + [id] profile
│       ├── cpq/              # CPQ configurator + templates
│       ├── sales/            # Quotes
│       ├── admin/            # Platform admin
│       └── settings/         # User/tenant settings
├── components/
│   ├── entity-view/          # Generic entity grid/cards/tags/tree
│   ├── configurator/         # CPQ configurator UI
│   ├── universal/            # Shared components (ActionWrapper, FilterStrip, etc.)
│   ├── ui/                   # shadcn/ui primitives (Button, Dialog, etc.)
│   ├── cpq/                  # CPQ-specific components
│   ├── products/             # Product-specific components
│   └── sales/                # Quote builder components
├── lib/
│   ├── action-result.ts      # ActionResult<T> type + helpers
│   ├── hooks/
│   │   └── useAction.ts      # useAction() hook — loading/error/retry
│   ├── schemas/              # JSONB field Zod schemas (source of truth)
│   ├── cpq/
│   │   ├── validators.ts     # CPQ-specific Zod schemas
│   │   └── CPQValidationService.ts  # Business rule engine
│   ├── supabase/             # Supabase client setup (server + browser + admin)
│   ├── auth/                 # Auth utilities (getTenantId)
│   └── translations.ts       # i18n strings (en + he)
├── hooks/                    # App-level hooks (useGridPersistence, useDebounce, useToast)
├── context/                  # React contexts (Language, Session)
└── types/                    # Shared TypeScript types
```

---

## Action Layer

The project uses a three-tier pattern for server action calls:

```
Server Action (actions/*.ts)   →   Returns ActionResult<T>
        ↓
useAction() hook (lib/hooks/)  →   Manages loading/error/data/retry state
        ↓
ActionWrapper component        →   Render-prop with inline error UI + toast
```

### `useAction()` Hook

**Location:** `src/lib/hooks/useAction.ts`

Wraps any server action with reactive state management.

```typescript
import { useAction } from "@/lib/hooks/useAction";

// Basic usage:
const { execute, loading, error, data, retry, reset } = useAction<InputType, OutputType>(
    myServerAction,
    {
        onSuccess: (data) => { router.push(`/dashboard/${data.id}`); },
        onError: (error, code) => { console.error(error); },
        resetOnExecute: true,  // clear previous data on new call (default: true)
    }
);

// In JSX:
<Button onClick={() => execute(formData)} disabled={loading}>
    {loading ? "שומר..." : "שמור"}
</Button>
{error && <p className="text-destructive">{error}</p>}
```

**Returns:**

| Field | Type | Description |
|---|---|---|
| `execute` | `(...args) => Promise<ActionResult<T>>` | Call the action |
| `loading` | `boolean` | True while executing |
| `error` | `string \| null` | Error message from last call |
| `errorCode` | `string \| null` | Error code (e.g. `"VALIDATION_ERROR"`) |
| `data` | `T \| null` | Data from last successful call |
| `retry` | `() => Promise<...>` | Re-execute with same args |
| `reset` | `() => void` | Clear all state |

### `ActionWrapper` Component

**Location:** `src/components/universal/ActionWrapper.tsx`

Higher-level render-prop component with built-in inline error alert, retry button, loading hint, and Sonner toast.

```tsx
import { ActionWrapper } from "@/components/universal/ActionWrapper";

<ActionWrapper
    action={() => createPerson(data)}
    onSuccess={(result) => router.push(`/dashboard/people/${result.id}`)}
    successMessage="איש קשר נוצר בהצלחה"
    errorMessage="שגיאה ביצירת איש קשר"
    loadingText="יוצר..."
>
    {({ execute, isLoading }) => (
        <Button onClick={execute} disabled={isLoading}>
            שמור
        </Button>
    )}
</ActionWrapper>
```

**When to use which:**

| Scenario | Use |
|---|---|
| Full control over UI (custom error display, complex forms) | `useAction()` |
| Simple submit button with standard error/retry UI | `ActionWrapper` |

---

## Server Action Boilerplate

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/auth/tenant";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";
import { mySchema } from "@/lib/schemas/my-schema";

export async function myAction(
    input: z.infer<typeof mySchema>
): Promise<ActionResult<MyReturnType>> {
    try {
        // 1. Validate input
        const parsed = mySchema.safeParse(input);
        if (!parsed.success) {
            return actionError(parsed.error.errors[0].message, "VALIDATION_ERROR");
        }

        // 2. Auth + tenant
        const cookieStore = await cookies();
        const supabase = await createClient(cookieStore);
        const tenantId = await getTenantId();
        if (!tenantId) return actionError("Tenant not found", "AUTH_ERROR");

        // 3. Business logic
        const { data, error } = await supabase
            .from("my_table")
            .select("*")
            .eq("tenant_id", tenantId);

        if (error) return actionError(error.message, "DB_ERROR");

        // 4. Return
        return actionSuccess(data);
    } catch (err: any) {
        return actionError(err.message || "Unknown error");
    }
}
```

---

## Schema Locations

| Schema Type | Location |
|---|---|
| CPQ templates, options, rules | `src/lib/cpq/validators.ts` |
| JSONB field schemas | `src/lib/schemas/*.ts` |
| Form validation | Co-located with form component |
| DB constraints | `supabase/migrations/` |

---

## AG Grid

- **Version:** v35 — uses built-in Theming API (`themeQuartz`)
- **Do NOT** use `theme="legacy"` or import `ag-grid-community/styles/*.css`
- **Do NOT** use CSS classes like `ag-theme-quartz`
- Module registration is in `src/lib/ag-grid-registry.ts`
- Grid persistence via `useGridPersistence` hook

---

## Conventions

### Language & Typing
- **TypeScript strict** everywhere
- Use `type` for data shapes, `interface` for component props
- Avoid `any` — use `unknown` + type narrowing

### Styling
- **Tailwind CSS v4** with shadcn/ui components
- Use semantic color tokens: `bg-card`, `text-foreground`, `border-border`
- Dark/light via `next-themes` — never hardcode colors

### State Management
- React hooks + context (no Redux, no Zustand)
- Contexts: `LanguageContext`, `SessionContext`

### RTL & i18n
- Hebrew (RTL) is the primary UI language
- Use `dir="rtl"` on layout and `enableRtl` on AG Grid
- Translations in `src/lib/translations.ts` — always add both `en` and `he` keys
- All user-facing strings (button labels, toasts, error messages) should be in Hebrew

### IDs & Dates
- **IDs:** UUID v4 everywhere
- **Dates:** ISO 8601 strings

### Error Codes
Standard error codes used in `actionError()`:
- `VALIDATION_ERROR` — Input validation failed
- `AUTH_ERROR` — Not authenticated or no tenant
- `NOT_FOUND` — Entity not found
- `DB_ERROR` — Database operation failed
- `CONFLICT` — Optimistic lock or unique constraint violation

### Naming Conventions
- **Server actions:** `verbNoun` — `createPerson`, `updateTemplate`, `fetchProducts`
- **Hooks:** `use` prefix — `useAction`, `useGridPersistence`, `useDebounce`
- **Components:** PascalCase — `PersonFormDialog`, `ActionWrapper`
- **Action files:** `noun-actions.ts` — `template-actions.ts`, `quote-actions.ts`

---

## Entity View System

The `entity-view/` components power all CRM list pages (People, Organizations, Products).

- **4 view modes:** Tags, Grid, Cards, Tree
- **`useEntityView` hook** manages state: filters, sorting, pagination, view mode
- **`EntityViewLayout`** renders the toolbar, filter bar, and delegates to view renderers
- **`validFilterFields`** — each entity specifies which filter fields are valid, preventing cross-entity filter bleeding from URL params

### Saved Views

Saved views (filter presets) are stored in the `saved_views` table and **must be scoped by `entity_type`**:

```typescript
// Always pass entityType when loading/saving views
await getSavedViews(tenantId, entityType);  // e.g., 'people', 'organizations'
await saveView(tenantId, name, config, entityType);
```

The DB has a unique constraint on `(tenant_id, entity_type, name)`. Never share views across entity types.

---

## Migrations

- **Location:** `supabase/migrations/`
- **Naming:** `NNN_description.sql` (sequential number prefix)
- **Current count:** 244+
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Always include `OR REPLACE` for functions
- Test migrations include both the change and a rollback comment

---

## Testing

```bash
cd next-web
npm run test        # Watch mode
npm run test:run    # Single run (CI)
npm run test:ui     # Vitest UI
```

- Tests are in `src/test/`
- Use Vitest + custom mocks for Supabase
- Coverage: pricing, validation, schemas, tenant isolation, action-result helpers

---

## Quick Reference

### Common Imports
```typescript
// Action result
import { ActionResult, actionSuccess, actionError, actionOk } from "@/lib/action-result";

// useAction hook
import { useAction } from "@/lib/hooks/useAction";

// Supabase client (server actions)
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/tenant";

// UI primitives
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
```

### Running the App
```bash
cd next-web
npm run dev          # Start dev server
npm run build        # Production build
npm run verify       # System verification script
```
