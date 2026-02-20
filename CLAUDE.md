# Agent Instructions — NOW System

## Project Overview

NOW is a multi-tenant ERP/CRM + CPQ platform.

| Layer | Stack | Directory |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 | `next-web/` |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) | `supabase/` |
| Testing | Vitest (80+ unit tests) | `next-web/src/test/` |
| Styling | Tailwind CSS v4 + shadcn/ui | `next-web/src/components/ui/` |
| Plugins | Israeli tax (17% VAT + SHAAM) | `next-web/src/plugins/` |
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

### 3. Two Auth Patterns (Know Which to Use)

**Pattern A — CRM/CPQ actions** (original pattern):
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/auth/tenant";

export async function myAction(input: unknown): Promise<ActionResult<MyType>> {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const tenantId = await getTenantId();
    if (!tenantId) return actionError("Tenant not found", "AUTH_ERROR");
    // ...
}
```

**Pattern B — ERP actions (Phase 2+)** — use for ALL new ERP features (accounting, inventory, invoices, POs, payments):
```typescript
"use server";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function myAction(tenantId: string, ...args): Promise<ActionResult<MyType>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return auth;
    
    const supabase = createAdminClient(); // bypasses RLS, auth enforced above
    // ...
}
```

**When to use which:**

| Domain | Pattern | Auth file |
|---|---|---|
| People, Organizations, Products, CPQ | Pattern A | `@/lib/auth/tenant` |
| Accounting, Inventory, Invoices, POs, Payments, Price Lists, Variants, Approvals | Pattern B | `actions/_shared/auth.ts` |

**Rule:** Never mix patterns. New ERP features always use Pattern B.

### 4. Every Server Action Must Use Zod Validation
```typescript
import { mySchema } from "./_shared/schemas"; // Phase 2+ schemas
// OR
import { mySchema } from "@/lib/schemas/my-schema"; // CRM/CPQ schemas
```

### 5. Use `ActionResult<T>` for All Server Action Return Types
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

### 6. Use `useAction()` Hook for Client-Side Action Calls
Never call server actions directly in event handlers. Always wrap with `useAction()`:
```typescript
// ✅ Correct
const { execute, loading, error, data, retry } = useAction(createTemplate);
const handleSubmit = () => execute(formData);

// ❌ Wrong — no loading/error handling
const handleSubmit = async () => { await createTemplate(formData); };
```

### 7. Never Hardcode GL Account Numbers in RPCs
```sql
-- ❌ WRONG:
SELECT id INTO v_account FROM chart_of_accounts
WHERE tenant_id = v_tenant_id AND account_number = '1300';

-- ✅ CORRECT:
SELECT id INTO v_account FROM chart_of_accounts
WHERE tenant_id = v_tenant_id AND account_sub_type = 'accounts_receivable';

IF v_account IS NULL THEN
  RAISE EXCEPTION 'Required account type accounts_receivable not found for tenant %', v_tenant_id;
END IF;
```

### 8. All Multi-Step DB Writes Must Be a Single RPC
If an operation touches multiple tables (e.g. create journal entry + update inventory + update invoice status), it must be a single PostgreSQL RPC function. Never do multi-step writes across separate Supabase calls.

---

## RPC Pattern (Phase 2+)

All complex database operations use PostgreSQL functions:

```sql
CREATE OR REPLACE FUNCTION my_rpc_name(
  p_param1 uuid,
  p_param2 jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Get tenant from auth
  v_tenant_id := (
    SELECT raw_app_meta_data->>'tenant_id'
    FROM auth.users
    WHERE id = auth.uid()
  );
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found for authenticated user';
  END IF;

  -- 2. Verify the target entity belongs to this tenant
  -- (always check tenant_id on the primary entity)

  -- 3. Business logic (all in one transaction)

  -- 4. Return result as JSONB
  RETURN v_result;
END;
$$;
```

**Key rules:**
- Always `SECURITY DEFINER` + `SET search_path = public`
- Always extract `tenant_id` from `auth.uid()` inside the RPC (never trust client)
- Always `RAISE EXCEPTION` on invalid state (never silently skip)
- Always return `jsonb` for complex results

---

## Account Classification System

`chart_of_accounts` uses two levels of classification:

| Column | Purpose | Values |
|---|---|---|
| `account_type` | Broad category (for financial reports) | `asset`, `liability`, `equity`, `revenue`, `expense` |
| `account_sub_type` | Specific role (for RPC lookups) | `cash`, `accounts_receivable`, `accounts_payable`, `inventory`, `tax_liability`, `revenue`, `cogs` |

**Rule:** RPCs that create journal entries always look up by `account_sub_type`. If not found → `RAISE EXCEPTION`.

---

## Document Number Sequences

Shared numbering for invoices, POs, and payments:

```sql
-- Table: document_number_sequences
-- Columns: tenant_id, document_type ('invoice'|'po'|'payment'), prefix, next_number

-- RPC: generate_document_number(p_tenant_id, p_document_type)
-- Returns: 'INV-00001', 'PO-00001', 'PAY-00001' etc.
```

---

## Plugin System

Israeli market compliance is handled via a plugin system:

```
plugins/
├── registry.ts    — singleton plugin registry
├── il.ts          — Israeli tax: 17% VAT, SHAAM queue compliance
└── index.ts       — exports
```

- `il.ts` provides VAT rate calculation and SHAAM reporting hooks
- POs and invoices reference `tax_zone_id` for plugin-based tax calculation
- New market plugins follow the same pattern (register in `registry.ts`)

---

## File Structure

```
next-web/src/
├── app/
│   ├── actions/
│   │   ├── _shared/              # Shared auth + validation (Phase 2+)
│   │   │   ├── auth.ts           # verifyAuth, verifyAuthWithTenant (async, 'use server')
│   │   │   ├── auth-utils.ts     # isAuthError, ActionResult<T> (sync, NOT 'use server')
│   │   │   └── schemas.ts        # Zod schemas for all ERP actions
│   │   ├── cpq/                  # CPQ-specific actions (10 files)
│   │   ├── accounting-actions.ts # Accounts, journal, trial balance, P&L, balance sheet
│   │   ├── price-list-actions.ts # CRUD, effective price, customer assignment
│   │   ├── variant-actions.ts    # Attributes, values, product variants
│   │   ├── profitability-actions.ts # Margin validate, approve, reject
│   │   ├── warehouse-actions.ts  # CRUD, stock, transfers
│   │   ├── invoice-actions.ts    # List, create from quote, issue, cancel, mark paid
│   │   ├── purchase-order-actions.ts # Vendor CRUD, PO lifecycle
│   │   ├── payment-actions.ts    # CRUD, allocations, post, void
│   │   ├── quote-actions.ts      # Quote CRUD
│   │   └── currency-actions.ts   # Currency operations
│   └── dashboard/
│       ├── people/               # People list + [id] profile
│       ├── organizations/        # Orgs list + [id] profile
│       ├── products/             # Products list + [id] profile
│       ├── cpq/                  # CPQ configurator + templates
│       ├── sales/                # Quotes
│       ├── accounting/           # Chart of Accounts, Journal, Trial Balance, P&L, Balance Sheet
│       ├── inventory/warehouses/ # Warehouse management + transfers
│       ├── invoices/             # Invoice management
│       ├── purchase-orders/      # Vendor + PO management
│       ├── payments/             # Customer receipts + vendor payments
│       ├── approvals/            # Margin approval queue
│       ├── price-lists/          # Price list management
│       ├── admin/                # Platform admin
│       └── settings/             # User/tenant settings
├── components/
│   ├── entity-view/              # Generic entity grid/cards/tags/tree (CRM)
│   ├── configurator/             # CPQ configurator UI
│   ├── universal/                # Shared (ActionWrapper, FilterStrip, etc.)
│   ├── ui/                       # shadcn/ui primitives
│   ├── cpq/                      # CPQ-specific components
│   ├── products/                 # Product-specific components
│   ├── sales/                    # Quote builder components
│   ├── QuoteBuilder.tsx          # Full quote flow with pricing, margin, approval, invoice gen
│   ├── PriceListManager.tsx      # Price list CRUD + items + customer assignment
│   ├── ProductVariantsPanel.tsx  # Attributes, variants, generate combinations
│   ├── AccountingDashboard.tsx   # 5 tabs: accounts, journal, trial balance, P&L, balance sheet
│   ├── WarehouseDashboard.tsx    # Warehouses + transfers
│   ├── InvoiceDashboard.tsx      # Invoice list with status filter + actions
│   ├── PurchaseOrderDashboard.tsx # Vendors + PO management with full lifecycle
│   ├── PaymentDashboard.tsx      # Customer receipts + vendor payments with allocation
│   └── ApprovalQueue.tsx         # Margin approval queue
├── plugins/
│   ├── registry.ts               # Plugin registry singleton
│   ├── il.ts                     # Israeli tax plugin (17% VAT + SHAAM)
│   └── index.ts                  # Plugin exports
├── lib/
│   ├── action-result.ts          # ActionResult<T> type + helpers
│   ├── hooks/
│   │   └── useAction.ts          # useAction() hook — loading/error/retry
│   ├── schemas/                  # JSONB field Zod schemas
│   ├── cpq/
│   │   ├── validators.ts         # CPQ Zod schemas
│   │   └── CPQValidationService.ts
│   ├── supabase/                 # Supabase clients (server + browser + admin)
│   ├── auth/                     # Auth utilities (getTenantId — Pattern A)
│   └── translations.ts           # i18n strings (en + he)
├── hooks/                        # App-level hooks
├── context/                      # React contexts (Language, Session)
└── types/                        # Shared TypeScript types
```

---

## Database Tables (Key ERP Tables)

### Phase 1 (Foundation)
`bom_headers`, `bom_items`, `currencies`, `exchange_rates`, `tax_zones`, `tax_classes`, `tax_rates`, `tax_exemptions`, `il_shaam_queue`, `inventory_balances`, `inventory_ledger`, `quotes`, `quote_items`

### Phase 2 (Market Expansion)
`price_lists`, `price_list_items`, `customer_price_list`, `variant_attributes`, `variant_values`, `product_variants`, `margin_approvals`, `chart_of_accounts`, `journal_entries`, `journal_lines`

### Phase 3 (Full ERP)
`warehouses`, `warehouse_transfers`, `invoices`, `invoice_items`, `document_number_sequences`, `vendors`, `purchase_orders`, `purchase_order_items`, `payments`, `payment_allocations`

### Key RPCs
| RPC | Purpose | Phase |
|---|---|---|
| `get_effective_price()` | Price resolution (price list → customer → base) | 2 |
| `seed_il_chart_of_accounts()` | Israeli chart of accounts + sub_types | 2 |
| `generate_document_number()` | Sequential numbering (INV/PO/PAY) | 3 |
| `issue_invoice()` | Invoice posting + journal entry | 3 |
| `cancel_invoice()` | Invoice cancellation + reversing JE | 3 |
| `submit_purchase_order()` | PO validation + status change | 3 |
| `approve_purchase_order()` | PO approval recording | 3 |
| `receive_purchase_order()` | Goods receipt + inventory + journal entry | 3 |
| `cancel_purchase_order()` | PO cancellation | 3 |
| `post_payment()` | Payment posting + journal entry + invoice update | 3 |
| `void_payment()` | Payment void + reversing journal entry | 3 |

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

```typescript
import { useAction } from "@/lib/hooks/useAction";

const { execute, loading, error, data, retry, reset } = useAction<InputType, OutputType>(
    myServerAction,
    {
        onSuccess: (data) => { router.push(`/dashboard/${data.id}`); },
        onError: (error, code) => { console.error(error); },
        resetOnExecute: true,
    }
);
```

**Returns:**

| Field | Type | Description |
|---|---|---|
| `execute` | `(...args) => Promise<ActionResult<T>>` | Call the action |
| `loading` | `boolean` | True while executing |
| `error` | `string \| null` | Error message |
| `errorCode` | `string \| null` | Error code |
| `data` | `T \| null` | Last successful data |
| `retry` | `() => Promise<...>` | Re-execute same args |
| `reset` | `() => void` | Clear all state |

### `ActionWrapper` Component

**Location:** `src/components/universal/ActionWrapper.tsx`

```tsx
<ActionWrapper
    action={() => createPerson(data)}
    onSuccess={(result) => router.push(`/dashboard/people/${result.id}`)}
    successMessage="איש קשר נוצר בהצלחה"
    errorMessage="שגיאה ביצירת איש קשר"
    loadingText="יוצר..."
>
    {({ execute, isLoading }) => (
        <Button onClick={execute} disabled={isLoading}>שמור</Button>
    )}
</ActionWrapper>
```

| Scenario | Use |
|---|---|
| Full control over UI | `useAction()` |
| Simple submit with standard error/retry | `ActionWrapper` |

---

## Schema Locations

| Schema Type | Location |
|---|---|
| ERP actions (Phase 2+) | `src/app/actions/_shared/schemas.ts` |
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
- **Server actions:** `verbNoun` — `createPerson`, `updateTemplate`, `getPurchaseOrders`
- **Hooks:** `use` prefix — `useAction`, `useGridPersistence`
- **Components:** PascalCase — `PersonFormDialog`, `PurchaseOrderDashboard`
- **Action files:** `noun-actions.ts` — `payment-actions.ts`, `warehouse-actions.ts`
- **Dashboard components:** `NounDashboard.tsx` — `PaymentDashboard.tsx`, `InvoiceDashboard.tsx`

---

## Entity View System

The `entity-view/` components power all CRM list pages (People, Organizations, Products).

- **4 view modes:** Tags, Grid, Cards, Tree
- **`useEntityView` hook** manages state: filters, sorting, pagination, view mode
- **`EntityViewLayout`** renders the toolbar, filter bar, and delegates to view renderers
- **`validFilterFields`** — each entity specifies valid filter fields

### Saved Views
Stored in `saved_views` table, scoped by `entity_type`:
```typescript
await getSavedViews(tenantId, entityType);
await saveView(tenantId, name, config, entityType);
```
DB unique constraint: `(tenant_id, entity_type, name)`. Never share views across entity types.

---

## Migrations

- **Location:** `supabase/migrations/`
- **Naming:** `YYYYMMDD_description.sql` (date prefix)
- **Current count:** 34+ (Phase 1-3)
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Always use `OR REPLACE` for functions
- Never modify existing migrations — always create new ones

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
- Known: 125 pre-existing TS errors in CPQ/configurator/analytics — unrelated to ERP features

---

## Quick Reference

### Common Imports (CRM — Pattern A)
```typescript
import { ActionResult, actionSuccess, actionError, actionOk } from "@/lib/action-result";
import { useAction } from "@/lib/hooks/useAction";
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/tenant";
```

### Common Imports (ERP — Pattern B)
```typescript
import { ActionResult, actionSuccess, actionError, actionOk } from "@/lib/action-result";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { mySchema } from "./_shared/schemas";
```

### Common Imports (UI)
```typescript
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAction } from "@/lib/hooks/useAction";
```

### Running the App
```bash
cd next-web
npm run dev          # Start dev server
npm run build        # Production build
npm run verify       # System verification script
npx tsc --noEmit     # Type check (expect 125 pre-existing errors)
```