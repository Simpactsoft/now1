# Agent Instructions — NOW System

## Project Overview

NOW is a CRM + CPQ platform built with:
- **Frontend:** Next.js 15 (App Router) + React 19 in `next-web/`
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions)
- **Legacy:** Vue.js app in `web/` — **DEPRECATED, do not modify**

## Critical Rules

### 1. Never Touch Legacy `web/`
The `web/` directory is deprecated. All development happens in `next-web/`. See `web/DEPRECATED.md`.

### 2. Every New Table Must Have RLS Policies
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Minimum policies:
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
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

// Success:
return actionSuccess(data);

// Error:
return actionError("Something went wrong", "NOT_FOUND");
```

Exception: Grid/fetch actions use `GridResult<T>` for AG Grid compatibility.

## File Structure

```
next-web/src/
├── app/
│   ├── actions/          # Server actions (one file per domain)
│   │   ├── cpq/          # CPQ-specific actions
│   │   └── *.ts          # CRM actions
│   └── dashboard/        # Page routes
├── components/
│   ├── entity-view/      # Generic entity grid/cards/tags/tree
│   ├── configurator/     # CPQ configurator UI
│   ├── universal/        # Shared components (ActionWrapper, AddFilterCommand)
│   └── ui/               # shadcn/ui primitives
├── lib/
│   ├── action-result.ts  # ActionResult<T> type + helpers
│   ├── schemas/          # JSONB field Zod schemas (source of truth)
│   ├── cpq/
│   │   ├── validators.ts # CPQ-specific Zod schemas
│   │   └── CPQValidationService.ts # Business rule engine
│   ├── supabase/         # Supabase client setup
│   └── auth/             # Auth utilities
└── context/              # React contexts
```

## Schema Locations

| Schema Type | Location |
|---|---|
| CPQ templates, options, rules | `src/lib/cpq/validators.ts` |
| JSONB field schemas | `src/lib/schemas/*.ts` |
| Form validation | Co-located with form component |
| DB constraints | `supabase/migrations/` |

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

## AG Grid

- **Version:** v35 — uses built-in Theming API (`themeQuartz`)
- **Do NOT** use `theme="legacy"` or import `ag-grid-community/styles/*.css`
- **Do NOT** use CSS classes like `ag-theme-quartz`
- Module registration is in `src/lib/ag-grid-registry.ts`

## Conventions

- **Language:** TypeScript strict
- **Styling:** Tailwind CSS with shadcn/ui
- **State:** React hooks + context (no Redux)
- **RTL:** Hebrew/RTL support via `dir="rtl"` and `enableRtl` on AG Grid
- **Theme:** Dark/light via `next-themes`, use semantic tokens (`bg-card`, `text-foreground`)
- **IDs:** UUID v4 everywhere
- **Dates:** ISO 8601 strings
