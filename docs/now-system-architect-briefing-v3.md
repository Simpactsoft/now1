# NOW System — Architect Briefing Document
**Last Updated:** 2026-02-19
**Role:** You are the architect reviewing and directing an AG (AI code agent, Opus 4.6) that builds the NOW System.
**Your job:** Review AG output, find gaps, prepare focused prompts. You do NOT write code directly.


---


## 1. Project Overview


**NOW System** — Multi-tenant ERP/CRM platform
- **Stack:** Next.js 14 + Supabase (PostgreSQL)
- **Market:** Israeli SMB, extensible globally
- **Status:** Development only, no real users, fictitious data


---


## 2. Phase Status


| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Global Foundation | ✅ 100% | 12/12 tasks, all verified |
| Phase 2: Market Expansion | ✅ 100% | 4 tasks + hardening + UI, all verified |
| Phase 2 Fixes (Block E) | ✅ 100% | 5 architect-identified gaps fixed |
| Phase 2 Final Fixes (A/B/C) | ✅ 100% | isAuthError build fix, validateQuoteMargin wiring, journal Post/Void buttons |
| Phase 3 Batch 1 | ✅ 100% | Features 201, 203, 208 built and verified |
| Phase 3 Batch 2 | ✅ 100% | Features 202, 204 built + architect fix (account_sub_type resolution) |
| Phase 3 Batch 3+ | 📋 Not started | Features 205, 206, 207, 209, 210 |


---


## 3. Architecture Summary


### Backend Pattern
- **Auth:** `_shared/auth.ts` → `verifyAuthWithTenant()` on ALL server actions
- **Auth Utils:** `_shared/auth-utils.ts` → `isAuthError()`, `ActionResult<T>` (sync helpers, separate from 'use server' file)
- **Validation:** `_shared/schemas.ts` → Zod schemas for all Phase 2+ actions
- **Admin Client:** `createAdminClient()` bypasses RLS, server actions enforce auth explicitly
- **RPCs:** Complex/atomic logic in PostgreSQL (SECURITY DEFINER, SET search_path = public, internal tenant check)
- **Plugin System:** `registry.ts` + `il.ts` (Israeli tax 17% VAT + SHAAM compliance)
- **GL Account Resolution:** Always by `account_sub_type`, NEVER by hardcoded `account_number` (see Section 8)


### Account Classification (Two-Level System)
The system uses two levels of account classification in `chart_of_accounts`:

| Column | Purpose | Examples |
|--------|---------|---------|
| `account_type` | Broad category (for reporting) | `asset`, `liability`, `equity`, `revenue`, `expense` |
| `account_sub_type` | Specific role (for RPC lookups) | `cash`, `accounts_receivable`, `accounts_payable`, `inventory`, `tax_liability`, `revenue`, `cogs` |

**Rule:** All RPCs that create journal entries MUST look up accounts by `account_sub_type`, never by `account_number`. Missing account → `RAISE EXCEPTION`.


### Database (34+ migrations, 25+ RPCs)
**Phase 1 Tables:** bom_headers/items, currencies, exchange_rates, tax_zones/classes/rates/exemptions, il_shaam_queue, inventory_balances, quotes/quote_items
**Phase 2 Tables:** price_lists/items/customer_price_list, variant_attributes/values/product_variants, margin_approvals, chart_of_accounts, journal_entries/lines
**Phase 3 Batch 1 Tables:** warehouses, warehouse_transfers, invoices, invoice_items (+ ALTER on inventory_balances, inventory_ledger)
**Phase 3 Batch 2 Tables:** vendors, purchase_orders/items, payments, payment_allocations, document_number_sequences (renamed from invoice_number_sequences)
**Phase 3 Batch 2 ALTERs:** `chart_of_accounts` +account_sub_type, `invoices` +amount_paid +balance_due trigger


### Frontend Pages
- `/dashboard/price-lists` — PriceListManager
- `/dashboard/accounting` — AccountingDashboard (5 tabs: Accounts, Journal, Trial Balance, P&L, Balance Sheet)
- `/dashboard/approvals` — ApprovalQueue (margin approvals)
- `/dashboard/inventory/warehouses` — WarehouseDashboard
- `/dashboard/invoices` — InvoiceDashboard
- `/dashboard/purchase-orders` — PurchaseOrderDashboard (Vendors tab + PO tab)
- `/dashboard/payments` — PaymentDashboard (Customer Receipts + Vendor Payments)
- Products `[id]` page includes ProductVariantsPanel
- QuoteBuilder includes: getEffectivePrice integration, margin warning badge, Submit for Approval, Generate Invoice


---


## 4. Known Issues / Technical Debt


| Item | Severity | Status |
|------|----------|--------|
| `discount_percent` in price_list_items not used by `get_effective_price()` | Low | Open |
| 125 pre-existing TS errors in CPQ/configurator/analytics | None | Unrelated to Phase 3, ignore |
| No rate limiting on server actions | Low | Acceptable for current scale |


---


## 5. Phase 3 Feature Roadmap


| # | Feature | Dependencies | Status |
|---|---------|-------------|--------|
| 201 | Multi-warehouse inventory | inventory_balances | ✅ Complete |
| 202 | Purchase orders | chart_of_accounts, vendors | ✅ Complete |
| 203 | Invoice generation | quotes, chart_of_accounts | ✅ Complete |
| 204 | Payment tracking | journal_entries, invoices, purchase_orders | ✅ Complete |
| 208 | Financial reports (P&L, Balance Sheet) | journal_entries, chart_of_accounts | ✅ Complete |
| 207 | Automated SHAAM reporting | il_shaam_queue | 📋 Not started |
| 209 | Role-based action permissions | RBAC tables | 📋 Not started |
| 205 | E-commerce product catalog API | product_variants, price_lists | 📋 Not started |
| 206 | Customer portal | CRM cards | 📋 Not started |
| 210 | Workflow engine (approval chains) | margin_approvals pattern | 📋 Not started |


**Recommended Batch 3:** 207 (SHAAM Reporting) + 209 (RBAC) — compliance + security before external access.
**Recommended Batch 4:** 205 (E-commerce API) + 206 (Customer Portal) — external-facing features after RBAC.
**Recommended Batch 5:** 210 (Workflow Engine) — capstone feature.


---


## 6. Working Rules (Learned from Experience)


### For AG Prompts:
1. **Max 2-3 tasks per prompt.** More than that → AG misses details.
2. **Put constraints at the TOP**, not bottom. AG reads the beginning best.
3. **Explain WHY something is wrong**, not just what to change. AG makes better decisions with context.
4. **Always specify exact function names, file names, and expected behavior.** Vague = gaps.
5. **"Planning only, no code"** doesn't work reliably. If you need planning, ask for a specific document format.
6. **After each AG run:** get the report BEFORE restart (AG has context). Then restart for clean next session.
7. **Include a pre-req fix** if there's a pending issue that the new features depend on.
8. **Specify execution order** — AG follows steps better when numbered.
9. **AG may use a synonym** for what you asked (e.g. `account_sub_type` instead of `account_type` for lookups). Review the WHY — if the reasoning is sound, accept it.


### For Architect Review:
1. Check **security patterns** — auth, RLS, tenant isolation, SECURITY DEFINER tenant checks
2. Check **atomicity** — multi-step DB operations should be single RPCs
3. Check **hardcoded values** — account numbers, tax rates, thresholds should come from DB/tenant settings
4. Check **error handling** — silent failures are worse than crashes
5. Check **missing UI actions** — if backend supports Post/Void/Approve, UI must have buttons for it
6. Check **dependencies** — will this schema support the next feature without breaking changes?
7. Check **table renames/ALTERs** — do they break existing RPCs or actions?
8. Check **pre-req fixes** — if the prompt included a pre-req, verify it appears in the report


---


## 7. File Structure Reference


```
app/actions/
├── _shared/
│   ├── auth.ts              — verifyAuth, verifyAuthWithTenant (async, 'use server')
│   ├── auth-utils.ts        — isAuthError, ActionResult<T> (sync, NOT 'use server')
│   └── schemas.ts           — Zod validation schemas (all phases)
├── accounting-actions.ts    — 7+ actions (accounts, journal, trial balance, P&L, balance sheet)
├── price-list-actions.ts    — 7 actions (CRUD, effective price, customer assignment)
├── variant-actions.ts       — 7 actions (attributes, values, variants)
├── profitability-actions.ts — 4 actions (validate, approve, reject margin)
├── warehouse-actions.ts     — 8 actions (CRUD, stock, transfers)
├── invoice-actions.ts       — 7 actions (list, create from quote, issue, cancel, mark paid)
├── purchase-order-actions.ts — ~11 actions (vendors CRUD, PO CRUD, submit/approve/receive/cancel)
├── payment-actions.ts       — ~8 actions (CRUD, allocate, post, void)
├── quote-actions.ts         — quote CRUD
├── currency-actions.ts      — currency operations
└── cpq/                     — 10 CPQ action files (standardized auth)


supabase/migrations/
├── 20260212–20260219        — Phase 1 (12 migrations)
├── 20260220–20260225        — Phase 2 + hardening (6 migrations)
├── 20260219_financial_reports.sql      — Phase 3: P&L + Balance Sheet RPCs
├── 20260219_multi_warehouse.sql        — Phase 3: warehouses, transfers, altered inventory
├── 20260219_invoice_generation.sql     — Phase 3: invoices, items, numbering, issue/cancel RPCs
├── 20260220_purchase_orders.sql        — Phase 3 Batch 2: vendors, POs, items, RPCs
├── 20260220_payment_tracking.sql       — Phase 3 Batch 2: payments, allocations, RPCs, ALTER invoices
└── 20260220_account_type_resolution.sql — Phase 3 Batch 2 fix: account_sub_type + RPC fixes


components/
├── QuoteBuilder.tsx                    — full quote flow with pricing, margin, approval, invoice generation
├── PriceListManager.tsx                — price list CRUD + items + customer assignment
├── ProductVariantsPanel.tsx            — attributes, variants, generate combinations
├── AccountingDashboard.tsx             — 5 tabs (accounts, journal, trial balance, P&L, balance sheet)
├── WarehouseDashboard.tsx              — warehouses + transfers
├── InvoiceDashboard.tsx                — invoice list with status filter + actions
├── ApprovalQueue.tsx                   — margin approval queue
├── PurchaseOrderDashboard.tsx          — vendors + PO management with full lifecycle
└── PaymentDashboard.tsx                — customer receipts + vendor payments with allocation


plugins/
├── registry.ts              — singleton plugin registry
├── il.ts                    — Israeli tax (17% VAT) + SHAAM compliance
└── index.ts                 — plugin exports
```


---


## 8. Key Design Decisions Log


| Decision | Rationale | Phase |
|----------|-----------|-------|
| Vendors as separate table (not CRM contacts) | Vendors need tax_id, payment terms, PO-specific fields | Batch 2 |
| `document_number_sequences` (renamed from `invoice_number_sequences`) | Shared numbering pattern for INV/PO/PAY prefixes | Batch 2 |
| Two-level account classification (`account_type` + `account_sub_type`) | `account_type` for reporting (asset/liability/etc), `account_sub_type` for RPC lookups (cash/AR/AP/etc) | Batch 2 Fix |
| `balance_due` as trigger (not GENERATED ALWAYS) | ALTER TABLE ADD COLUMN can't reference other columns in GENERATED expression | Batch 2 |
| `void_payment` reverses by swapping JE debit/credit | No account lookup needed — operates on existing journal lines | Batch 2 Fix |
| `receive_purchase_order` as single atomic RPC | Updates inventory ledger + balances + journal entries in one transaction | Batch 2 |


---


## 9. How to Use This Document


When the user brings an AG report:
1. Read this document first to understand current state
2. Compare AG output against this document for consistency
3. Check the "Known Issues" section — is this already tracked?
4. Check "Working Rules" before writing prompts
5. Update this document with new findings after each review cycle
