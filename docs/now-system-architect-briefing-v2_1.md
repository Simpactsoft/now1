# NOW SYSTEM — AGENT OPERATIONAL CONTEXT
# Version: 2.0 | Updated: February 2026
# PURPOSE: Paste this at the start of every AI agent session.
# The agent uses this to: track progress, validate code, enforce architecture, answer "is this done correctly?"

---

## HOW TO USE THIS DOCUMENT

At the start of each work session, paste this entire file as context.
Then tell the agent: "We are working on task [ID]. Here is the code I wrote: [paste code]"
The agent will validate against the Definition of Done and Acceptance Tests below.

Update STATUS fields after each completed task.
Current legend: [ ] = not started | [~] = in progress | [x] = done | [!] = blocked

---

## SYSTEM IDENTITY

```
Platform:     NOW System — Multi-tenant SaaS ERP/CPQ
Stack:        Supabase (PostgreSQL 15+) + Next.js 15 App Router + React 19
Auth:         Supabase Auth + custom RBAC (owner / admin / member)
Tenancy:      Row-Level Security via tenant_id + get_current_tenant_id()
Language:     TypeScript (strict)
Actions:      Next.js Server Actions preferred over API routes
State:        React state only — no Redux/Zustand
Key pattern:  Global Core + Vertical Compliance Plugins (see ARCHITECTURE below)
```

---

## CRITICAL ARCHITECTURE RULES (enforce on every code review)

```
RULE-01: Every table MUST have RLS enabled and a policy using:
         USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)

RULE-02: tenant_id MUST be the FIRST column in every composite index.
         Wrong:  CREATE INDEX ON orders(status, tenant_id)
         Correct: CREATE INDEX ON orders(tenant_id, status, created_at DESC)

RULE-03: No hardcoded currency symbols ($, ₪, €) anywhere in frontend.
         Use: new Intl.NumberFormat(tenant.locale, {style:'currency', currency: tenant.base_currency})

RULE-04: No hardcoded tax rates (TAX_RATE = 0.17 is FORBIDDEN).
         Tax must come from: tax_rates table via getTaxPlugin(tenant.compliance_plugins)

RULE-05: Vertical plugin code (IL/, US/, EU/) must NEVER be imported by global core files.
         The Plugin Registry is the only bridge.

RULE-06: Never use UPDATE or DELETE on inventory_ledger — append-only.

RULE-07: All monetary columns: NUMERIC(15,4) for unit prices, NUMERIC(15,2) for totals.
         Quantities: NUMERIC(15,4) — never NUMERIC(15,2) (truncates 0.0125 kg etc.)

RULE-08: Every new table needs: id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         tenant_id, created_at TIMESTAMPTZ DEFAULT NOW()
         Most tables also need: updated_at TIMESTAMPTZ DEFAULT NOW() + trigger

RULE-09: Server Actions must revalidate path on mutation:
         import { revalidatePath } from 'next/cache'; revalidatePath('/dashboard/...')

RULE-10: BOM tables are append-safe but get_bom_tree() must have CYCLE detection.
         If you see the RPC without CYCLE clause — flag it immediately.
```

---

## EXISTING DATABASE TABLES (what already exists — do not recreate)

```sql
-- CONFIRMED EXISTING (from migrations 007, 245, 20260211):
products                  (id, tenant_id, supplier_id, category_id, sku, name,
                           cost_price NUMERIC(15,2), list_price NUMERIC(15,2),
                           track_inventory, min_stock_level, created_at, updated_at)

product_categories        (id, tenant_id, parent_id, path ltree, name, description)
-- Has recursive trigger for path maintenance

inventory_ledger          (id, tenant_id, product_id, warehouse_id, transaction_type,
                           quantity_change NUMERIC(15,4), reference_id, notes, created_at)
-- APPEND-ONLY. transaction_type: purchase|sale|adjustment|return

inventory_reservations    (id, tenant_id, product_id, order_id, quantity, expires_at)

orders                    (id, tenant_id, customer_id, order_number SERIAL, status,
                           total_amount, currency TEXT DEFAULT 'USD',
                           order_type TEXT DEFAULT 'order', created_at, updated_at)
-- status: draft|confirmed|shipped|cancelled
-- order_type: order|quote  ← quote-as-order is a KNOWN ANTI-PATTERN being migrated away

order_items               (id, tenant_id, order_id, product_id, quantity,
                           unit_price, total_price)

invoices                  (id, tenant_id, order_id, customer_id, status DEFAULT 'issued',
                           due_date, total_amount)
-- STUB — being extended in Phase 2

-- CPQ TABLES (migration 20260211):
product_templates         (id, tenant_id, name, description, base_price NUMERIC(15,2),
                           base_product_id, category_id, display_mode, is_active)

option_groups             (id, tenant_id, template_id, name, selection_type,
                           is_required, min_selections, max_selections,
                           source_type, source_category_id, category_price_mode)

options                   (id, tenant_id, group_id, name, sku, product_id,
                           price_modifier_type, price_modifier_amount,
                           is_default, is_available, display_order, image_url)

option_overrides          (id, tenant_id, group_id, product_id,
                           price_modifier_type, price_modifier_amount,
                           custom_name, custom_description)

configuration_rules       (id, tenant_id, template_id, rule_type, name, error_message,
                           if_option_id, if_group_id, if_product_id,
                           then_option_id, then_group_id, then_product_id,
                           quantity_min, quantity_max, discount_type, discount_value,
                           priority, is_active)

configurations            (id, tenant_id, template_id, user_id, session_id,
                           selected_options JSONB, base_price, options_total,
                           discount_amount, total_price, quantity,
                           status, inventory_reservation_status,
                           share_token TEXT UNIQUE, price_breakdown JSONB,
                           notes, expires_at, is_template, source_configuration_id)

configured_products       (id, tenant_id, configuration_id, generated_sku,
                           generated_name, final_price, bom_header_id, product_id,
                           bom_explosion_mode, configuration_snapshot JSONB)

template_presets          (id, template_id, tenant_id, name, description,
                           selected_options JSONB, badge_text,
                           cached_total_price, is_active)

-- BOM TABLES (created directly in DB — NO MIGRATION FILE YET — RISK!):
bom_headers               (id, tenant_id, product_id, version, status,
                           description, ...)
bom_items                 (id, bom_header_id, component_product_id, parent_item_id,
                           sequence, quantity, unit, scrap_factor,
                           is_assembly, is_phantom, ...)
-- RPCs: get_bom_tree(p_product_id, p_version), calculate_bom_cost(p_product_id, p_version)
```

---

## EXISTING SERVER ACTIONS (do not duplicate)

```
/actions/quote-actions.ts          getProductsForTenant(), saveQuote()
/actions/fetchQuotes.ts            fetchQuotes()
/actions/cpq/template-actions.ts   getTemplates, getTemplateById, createTemplate,
                                   updateTemplate, toggleTemplateActive,
                                   deleteTemplates, duplicateTemplate, getCategoryProducts
/actions/cpq/option-group-actions.ts  CRUD option groups
/actions/cpq/option-actions.ts        CRUD options
/actions/cpq/pricing-actions.ts       calculatePrice()
                                      Formula: T = (B + ΣO_add) × ΠM_mult − D
/actions/cpq/configuration-actions.ts save, get, update, complete, delete,
                                      duplicate, saveAsTemplate, clone
/actions/cpq/validation-actions.ts    validateConfiguration()
/actions/cpq/rule-actions.ts          CRUD rules
/actions/cpq/preset-actions.ts        CRUD presets
/actions/cpq/quote-integration-actions.ts  addConfiguredProductToQuote()
/actions/cpq/audit-actions.ts         audit logging
/api/bom/[productId]/route.ts         GET bom tree + cost
```

---

## PRICE CASCADE (authoritative — validate all pricing code against this)

```
Step 1 — BASE PRICE (priority order):
  a) BOM: calculate_bom_cost(productId) × markup_pct  → price_source = 'bom'
  b) CPQ: product_templates.base_price                → price_source = 'cpq'
  c) Manual: products.list_price                      → price_source = 'manual'

Step 2 — CPQ MODIFIERS (if configured product):
  T = (base + ΣO_add) × ΠM_mult − D
  [calculatePrice() in pricing-actions.ts — do not modify formula]

Step 3 — PRICE LIST OVERRIDE:
  resolve_price(customerId, productId, qty, date)
  Priority: customer-specific > customer-segment > global default
  Volume tiers from price_tiers table

Step 4 — CURRENCY CONVERSION:
  convert_currency(price, fromCurrency, toCurrency, tenantId, timestamp)
  Rate locked at time of order confirmation

Step 5 — PROFITABILITY GUARD:
  IF margin% < tenant.min_margin_pct → route to approval, do not block
  createQuoteApproval({ reason: 'below_minimum_margin', ... })

Step 6 — TAX:
  getTaxPlugin(tenant.compliance_plugins).calculateTax(zone, class, customer, amount)
  Returns: { taxRateId, taxName, rate, taxAmount }[]

Step 7 — FINAL:
  { subtotal, taxBreakdown[], total, currency, lockedFxRate }
```

---

## PLUGIN REGISTRY PATTERN (enforce on all tax/compliance code)

```typescript
// Location: next-web/src/lib/plugins/registry.ts

interface TaxPlugin {
  countryCode: string;
  calculateTax(params: TaxCalcParams): Promise<TaxResult[]>;
  validateInvoice?(invoice: Invoice): Promise<ValidationResult>;
  postInvoice?(invoice: Invoice): Promise<ComplianceResult>;
}

// Global core ONLY calls:
const plugin = getTaxPlugin(tenant.compliance_plugins);
const taxes = await plugin.calculateTax(params);

// NEVER in global core:
import { ilCalculateTax } from '@/app/verticals/IL/tax-plugin'; // ← FORBIDDEN
```

---

## TASK REGISTRY — PHASE 1 (Global Foundation)

### [ ] TASK-001 — BOM Migration File
```
Priority:     CRITICAL — do this before anything else
File:         supabase/migrations/20260212_bom_tables.sql
What:         Formalize the BOM tables that exist in DB but have no migration file

Definition of Done:
  - [ ] bom_headers CREATE TABLE with all existing columns
  - [ ] bom_items CREATE TABLE with all existing columns
  - [ ] RLS enabled on both tables
  - [ ] Policies: USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
  - [ ] get_bom_tree() RPC recreated with CYCLE detection
  - [ ] calculate_bom_cost() RPC recreated
  - [ ] Running supabase db reset does not lose BOM tables

Acceptance Tests (ask agent to verify):
  Q: Does get_bom_tree() have a WITH RECURSIVE ... CYCLE clause or depth counter?
  Q: Do both tables have RLS enabled?
  Q: Is tenant_id the first column in the primary composite index?
```

### [ ] TASK-002 — Tenant Global Settings
```
File:         supabase/migrations/20260213_tenant_global_settings.sql

Definition of Done:
  - [ ] ALTER TABLE tenants adds: base_currency CHAR(3) DEFAULT 'USD'
  - [ ] default_locale TEXT DEFAULT 'en-US'
  - [ ] timezone TEXT DEFAULT 'UTC'
  - [ ] rtl_enabled BOOLEAN DEFAULT FALSE
  - [ ] compliance_plugins TEXT[] DEFAULT '{}'
  - [ ] feature_flags JSONB DEFAULT '{}'
  - [ ] invoice_prefix TEXT DEFAULT 'INV'
  - [ ] quote_prefix TEXT DEFAULT 'QT'

Acceptance Tests:
  Q: Is base_currency on tenants (not on currencies table)?
  Q: Can I INSERT a tenant with compliance_plugins = ARRAY['IL','EU_VAT']?
```

### [ ] TASK-003 — Currency System
```
Files:
  supabase/migrations/20260214_currency_system.sql
  next-web/src/app/actions/currency-actions.ts
  next-web/src/lib/plugins/registry.ts (create file)

Definition of Done:
  - [ ] currencies reference table: code CHAR(3) PK, name, symbol, decimal_places, is_active
  - [ ] Seeded with: USD, EUR, ILS, GBP, JPY, CAD, AUD, CHF, SGD, AED, BRL, MXN
  - [ ] exchange_rates: id, tenant_id, from_currency, to_currency, rate NUMERIC(18,8),
        valid_from TIMESTAMPTZ, source TEXT
  - [ ] CONSTRAINT chk_not_same CHECK (from_currency <> to_currency)
  - [ ] RLS on exchange_rates (currencies has no RLS — it's global reference)
  - [ ] INDEX: (tenant_id, from_currency, to_currency, valid_from DESC)
  - [ ] convert_currency() RPC: tries direct rate, then tries inverse (1/rate)
  - [ ] If no rate found: RAISE EXCEPTION with clear message
  - [ ] Server Action: getExchangeRates(), upsertExchangeRate()

Acceptance Tests:
  Q: Does convert_currency('ILS','ILS', ...) return the input amount unchanged?
  Q: Does convert_currency() try the inverse rate if direct rate missing?
  Q: Is is_base_currency on the tenants table (NOT on the currencies table)?
  Q: Does the index have tenant_id as first column?
```

### [ ] TASK-004 — Replace Hardcoded Currency in Frontend
```
Files:
  next-web/src/components/sales/QuoteBuilder.tsx
  next-web/src/lib/format.ts (create)
  All components with hardcoded '$'

Definition of Done:
  - [ ] No literal '$' or '₪' or '€' in any .tsx file
  - [ ] format.ts exports: formatCurrency(amount, currency, locale) using Intl.NumberFormat
  - [ ] formatCurrency used everywhere prices are displayed
  - [ ] QuoteBuilder receives currency from tenant context, not hardcoded

Acceptance Tests:
  Q: grep -r '"\$"' src/components — returns 0 results?
  Q: grep -r "'\$'" src/components — returns 0 results?
  Q: Does formatCurrency(1234.5, 'ILS', 'he-IL') return '1,234.50 ₪'?
```

### [ ] TASK-005 — Global Tax Engine
```
File: supabase/migrations/20260215_tax_engine.sql

Definition of Done:
  - [ ] tax_zones: id, tenant_id, name, country_codes CHAR(2)[], is_default, metadata JSONB
  - [ ] tax_classes: id, tenant_id, name, description, is_default
  - [ ] tax_rates: id, tenant_id, zone_id, tax_class_id, name, rate NUMERIC(10,6),
        is_compound, valid_from DATE, valid_to DATE,
        compliance_plugin TEXT, plugin_metadata JSONB
  - [ ] tax_exemptions: id, tenant_id, customer_id, tax_zone_id,
        exemption_number, reason, valid_from, valid_to, document_url
  - [ ] RLS on all four tables
  - [ ] Index on tax_rates: (tenant_id, zone_id, valid_from)
  - [ ] calculate_tax() RPC: checks exemptions first, returns TABLE of matching rates

Acceptance Tests:
  Q: Does calculate_tax() return empty result set for exempt customers (not zero-rate row)?
  Q: Is compliance_plugin column nullable (NULL for global core rates)?
  Q: Can valid_to be NULL (meaning "currently active")?
```

### [ ] TASK-006 — Remove Hardcoded Tax Rate
```
File: next-web/src/components/sales/QuoteBuilder.tsx

Definition of Done:
  - [ ] Line `const TAX_RATE = 0.17` is deleted
  - [ ] Tax is fetched from DB via getTaxForQuote(tenantId, customerId, zoneId)
  - [ ] QuoteBuilder shows tax breakdown per line (name + rate + amount)
  - [ ] Zero-tax tenants (US without nexus) show $0.00 tax correctly

Acceptance Tests:
  Q: Does grep 'TAX_RATE' QuoteBuilder.tsx return 0 results?
  Q: Does the component handle the case where tax_rates returns empty array?
```

### [ ] TASK-007 — Plugin Registry
```
File: next-web/src/lib/plugins/registry.ts

Definition of Done:
  - [ ] TaxPlugin interface defined (countryCode, calculateTax, validateInvoice?, postInvoice?)
  - [ ] CompliancePlugin interface defined
  - [ ] registerTaxPlugin() and getTaxPlugin() functions exported
  - [ ] defaultTaxPlugin: uses tax_rates table directly, no country-specific logic
  - [ ] getTaxPlugin returns defaultTaxPlugin if countryCode not registered
  - [ ] No vertical plugin is imported in this file

Acceptance Tests:
  Q: Does getTaxPlugin('XX') return the default plugin without throwing?
  Q: Does the file contain any import from '@/app/verticals/'? (answer must be NO)
```

### [ ] TASK-008 — IL Vertical Plugin
```
Files:
  supabase/vertical/IL/schema.sql
  next-web/src/app/verticals/IL/tax-plugin.ts
  next-web/src/app/verticals/IL/shaam-service.ts

Definition of Done:
  - [ ] schema.sql: ALTER TABLE invoices adds ita_allocation_number, ita_clearance_status,
        ita_response_payload JSONB, ita_requested_at, ita_cleared_at,
        supplier_vat_number, customer_vat_number
  - [ ] il_shaam_queue table: id, tenant_id, invoice_id, payload JSONB, status,
        attempt_count, last_attempt_at, next_attempt_at, error_message, allocation_number
  - [ ] IL tax plugin registered via registerTaxPlugin({ countryCode: 'IL', ... })
  - [ ] Plugin only activated when 'IL' in tenant.compliance_plugins
  - [ ] SHAAM thresholds table (or config): NIS 25000/20000/10000/5000 by date
  - [ ] Eilat Free Trade Zone: 0% rate seeded
  - [ ] Israel Domestic: 17% rate seeded

Acceptance Tests:
  Q: Is il_shaam_queue only created when IL plugin is provisioned?
  Q: Does the IL plugin check invoice total against current threshold before queuing?
  Q: Does ita_clearance_status default to 'not_required' (not 'pending')?
```

### [ ] TASK-009 — Inventory Balances (materialized)
```
File: supabase/migrations/20260216_inventory_balances.sql

Definition of Done:
  - [ ] inventory_balances table: (tenant_id, product_id, warehouse_id) PK,
        quantity NUMERIC(15,4), last_updated TIMESTAMPTZ
  - [ ] Trigger on inventory_ledger INSERT: upserts into inventory_balances
  - [ ] Optional: negative stock check (controlled by tenant feature_flags.prevent_negative_stock)
  - [ ] RLS on inventory_balances
  - [ ] All existing code that did SUM(quantity_change) updated to SELECT FROM inventory_balances

Acceptance Tests:
  Q: After INSERT into inventory_ledger, does inventory_balances reflect the change?
  Q: Is the trigger AFTER INSERT (not BEFORE)?
  Q: Does the query for "current stock" use inventory_balances, not SUM on ledger?
```

### [ ] TASK-010 — Critical Indexes
```
File: supabase/migrations/20260217_performance_indexes.sql

Definition of Done (all of these must exist):
  - [ ] CREATE INDEX CONCURRENTLY idx_orders_tenant_date ON orders(tenant_id, created_at DESC)
  - [ ] CREATE INDEX CONCURRENTLY idx_order_items_tenant ON order_items(tenant_id, product_id, order_id)
  - [ ] CREATE INDEX CONCURRENTLY idx_inventory_ledger_tenant ON inventory_ledger(tenant_id, product_id, created_at DESC)
  - [ ] CREATE INDEX CONCURRENTLY idx_configurations_tenant ON configurations(tenant_id, template_id, status, created_at DESC)
  - [ ] CREATE INDEX CONCURRENTLY idx_products_tenant_sku ON products(tenant_id, sku)
  - [ ] RLS function updated with IS NOT NULL guard

Acceptance Tests:
  Q: Run EXPLAIN ANALYZE SELECT * FROM orders WHERE tenant_id = '...' ORDER BY created_at DESC LIMIT 20
     — does it show "Index Scan" not "Seq Scan"?
```

### [ ] TASK-011 — Quotes Table (separate from orders)
```
Files:
  supabase/migrations/20260218_quotes_table.sql
  next-web/src/app/actions/quote-actions.ts (major refactor)

Definition of Done:
  - [ ] quotes table: id, tenant_id, quote_number TEXT, revision INT DEFAULT 1,
        parent_quote_id UUID, customer_id, status, currency, exchange_rate,
        subtotal, discount_amount, tax_amount, total_amount,
        valid_until DATE, payment_terms, billing_address JSONB,
        shipping_address JSONB, notes, internal_notes,
        created_by, approved_by, converted_order_id,
        share_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
        created_at, updated_at
  - [ ] status CHECK: draft|pending_approval|approved|rejected|sent|accepted|declined|expired|converted
  - [ ] quote_items table: id, tenant_id, quote_id, product_id, configuration_id,
        description, quantity NUMERIC(15,4), unit_price NUMERIC(15,4),
        discount_pct, discount_amount, tax_rate, tax_amount,
        line_total NUMERIC(15,2), sort_order, notes
  - [ ] generate_quote_number() function: returns 'QT-2026-00001' format
  - [ ] Trigger: auto-set quote_number on INSERT
  - [ ] RLS on both tables
  - [ ] Data migration: existing orders WHERE order_type='quote' → quotes table
  - [ ] saveQuote() Server Action updated to write to quotes table
  - [ ] getQuotes() returns from quotes table

Acceptance Tests:
  Q: Does quote_number auto-generate on INSERT?
  Q: Is revision = 2 when a quote is cloned from revision 1 via parent_quote_id?
  Q: Do quote_items have NUMERIC(15,4) for quantity (not NUMERIC(15,2))?
```

### [ ] TASK-012 — RTL Layout
```
Files:
  next-web/src/app/layout.tsx
  next-web/src/app/globals.css
  next-web/tailwind.config.ts

Definition of Done:
  - [ ] layout.tsx reads tenant.rtl_enabled and tenant.default_locale
  - [ ] <html lang={locale} dir={rtlEnabled ? 'rtl' : 'ltr'}>
  - [ ] Heebo font loaded for he-IL locale
  - [ ] Tailwind configured with: RTL plugin or manual ms-/me- utility usage
  - [ ] No hardcoded ml- or mr- classes in shared components (use ms-/me-)
  - [ ] AG Grid: enableRtl prop set from tenant config

Acceptance Tests:
  Q: For a tenant with rtl_enabled=true, does the layout have dir="rtl"?
  Q: Is Heebo font loaded only for Hebrew locale (not for all tenants)?
```

---

## TASK REGISTRY — PHASE 2 (Market Expansion)

### [ ] TASK-101 — Price Lists
```
File: supabase/migrations/20260301_price_lists.sql
      next-web/src/app/actions/price-list-actions.ts

Definition of Done:
  - [ ] price_lists: id, tenant_id, name, currency CHAR(3), priority INT,
        pricing_method (explicit|cost_plus|list_pct_discount),
        markup_pct, discount_pct, valid_from TIMESTAMPTZ, valid_to TIMESTAMPTZ,
        is_default BOOLEAN
  - [ ] price_list_assignments: price_list_id, customer_id OR customer_segment
  - [ ] price_list_items: price_list_id, product_id OR category_id
  - [ ] price_tiers: price_list_item_id, min_quantity, max_quantity, unit_price
  - [ ] resolve_price() RPC: returns winning price for (customer, product, qty, date)
  - [ ] Priority ORDER: customer-specific > segment > default
  - [ ] RLS on all tables

Acceptance Tests:
  Q: If two lists match same customer, does priority INT determine winner?
  Q: Does resolve_price() return the tier price when qty=50 and tier starts at 25?
  Q: Does is_default list apply to customers with no specific assignment?
```

### [ ] TASK-102 — Product Variants
```
File: supabase/migrations/20260302_product_variants.sql

Definition of Done:
  - [ ] variant_attributes: id, tenant_id, name, display_type, sort_order
  - [ ] variant_attribute_values: id, tenant_id, attribute_id, value, display_value, metadata JSONB, sort_order
  - [ ] product_families: id, tenant_id, name, base_sku, attribute_ids UUID[]
  - [ ] product_variants: id, tenant_id, family_id, product_id (→products), attribute_values JSONB,
        price_modifier NUMERIC(15,4), is_default, is_available, sort_order
  - [ ] GIN index on product_variants.attribute_values
  - [ ] RLS on all tables

Acceptance Tests:
  Q: Does product_variants.product_id link to an actual products.id (real SKU)?
  Q: Can I query: SELECT * FROM product_variants WHERE attribute_values @> '{"color":"red"}'?
```

### [ ] TASK-103 — Profitability Validator
```
File: next-web/src/app/actions/quote-actions.ts (add validateProfitability)
      next-web/src/app/actions/approval-actions.ts (create)

Definition of Done:
  - [ ] validateProfitability(quoteId, tenantId) returns ProfitabilityResult
  - [ ] Reads min_margin_pct from tenant settings (feature_flags or dedicated column)
  - [ ] Calculates: (totalPrice - totalBomCost) / totalPrice * 100
  - [ ] If below threshold: calls createQuoteApproval() automatically
  - [ ] Does NOT block — routes to approval instead
  - [ ] quote_approvals table: id, tenant_id, quote_id, approver_id, status,
        decision_at, comments, required_by, margin_pct, minimum_margin_pct
  - [ ] approval_thresholds table: min_amount, max_amount, currency, approver_role

Acceptance Tests:
  Q: Does a quote with margin 5% when min is 20% trigger approval (not rejection)?
  Q: Does a quote with no BOM cost skip the check gracefully?
```

### [ ] TASK-104 — Accounting MVP
```
File: supabase/migrations/20260303_accounting.sql

Definition of Done:
  - [ ] chart_of_accounts: id, tenant_id, account_code, path ltree,
        name, type (asset|liability|equity|revenue|expense|cogs),
        normal_balance (debit|credit), is_active, is_system
  - [ ] GiST index on path (ltree)
  - [ ] journal_entries: id, tenant_id, entry_number, entry_date,
        description, source_type, source_id UUID, status (draft|posted|reversed),
        reversal_of UUID, posted_by, posted_at
  - [ ] journal_lines: id, tenant_id, entry_id, account_id, debit NUMERIC(20,4),
        credit NUMERIC(20,4), currency, fx_rate, memo
  - [ ] CONSTRAINT: NOT (debit > 0 AND credit > 0)
  - [ ] DEFERRABLE CONSTRAINT TRIGGER: validates SUM(debit) = SUM(credit) per entry
  - [ ] payments table: id, tenant_id, payment_number, customer_id, invoice_id,
        amount, currency, payment_method, payment_date, reference, status, journal_entry_id
  - [ ] Auto-journal trigger/action: on invoice status→'paid' creates journal entry

Acceptance Tests:
  Q: Does inserting an unbalanced journal_entry_lines set raise an exception?
  Q: Is the balance check DEFERRABLE (allowing multi-row inserts in one transaction)?
  Q: Does chart_of_accounts use ltree path (consistent with product_categories)?
```

---

## TASK REGISTRY — PHASE 3 (Enterprise + E-Commerce)

### [ ] TASK-201 — E-Commerce Storefront
### [ ] TASK-202 — Shopping Cart + Cart Merge
### [ ] TASK-203 — CPQ in Public Storefront
### [ ] TASK-204 — Customer Portal Accounts
### [ ] TASK-205 — Checkout + Stripe
### [ ] TASK-206 — Xero/QuickBooks Sync
### [ ] TASK-207 — Financial Reports (P&L, Balance Sheet)
### [ ] TASK-208 — Declarative Table Partitioning
### [ ] TASK-209 — EU VAT Plugin
### [ ] TASK-210 — GCC/UAE Plugin (Fatoora)

```
[Phase 3 tasks will be expanded into full Definition of Done cards
 when Phase 2 is 80% complete]
```

---

## RISK REGISTER (check before starting each task)

```
RISK-01 [CRITICAL — NOW]: BOM tables have no migration file
  Check: ls supabase/migrations/ | grep bom
  Fix:   TASK-001

RISK-02 [CRITICAL — NOW]: get_bom_tree() has no CYCLE detection
  Check: SELECT prosrc FROM pg_proc WHERE proname = 'get_bom_tree'
         Look for: CYCLE or depth counter
  Fix:   Add to TASK-001

RISK-03 [CRITICAL — NOW]: RLS policies missing IS NOT NULL guard
  Check: SELECT * FROM pg_policies WHERE qual NOT LIKE '%IS NOT NULL%'
  Fix:   TASK-010

RISK-04 [HIGH]: orders.currency column exists but unused
  Fix:   TASK-011 (quotes table migration)

RISK-05 [HIGH]: QuoteBuilder.tsx has TAX_RATE = 0.17
  Fix:   TASK-006

RISK-06 [HIGH]: All prices display hardcoded '$'
  Fix:   TASK-004

RISK-07 [MEDIUM]: inventory SUM queries will degrade at 100K+ products
  Fix:   TASK-009

RISK-08 [MEDIUM]: Missing composite indexes on all major tables
  Fix:   TASK-010
```

---

## HOW AGENT VALIDATES CODE

When reviewing a pull request or code snippet, the agent checks:

```
CHECKLIST (run against every migration file):
  [ ] Every CREATE TABLE has: id UUID PK, tenant_id UUID NOT NULL REFERENCES tenants(id)
  [ ] Every table has: ALTER TABLE x ENABLE ROW LEVEL SECURITY
  [ ] Every table has: CREATE POLICY ... USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
  [ ] Monetary columns: NUMERIC(15,4) for unit, NUMERIC(15,2) for totals
  [ ] Quantity columns: NUMERIC(15,4) — never INT or NUMERIC(15,2)
  [ ] Primary composite index has tenant_id FIRST

CHECKLIST (run against every Server Action):
  [ ] No hardcoded currency symbol
  [ ] No hardcoded tax rate
  [ ] Calls revalidatePath() after mutations
  [ ] Returns typed result object (not raw Supabase response)
  [ ] Has error handling (try/catch or .catch())
  [ ] No direct import from verticals/ folder (if in global core)

CHECKLIST (run against every React component):
  [ ] Uses formatCurrency() from @/lib/format — not template literals with '$'
  [ ] Currency symbol comes from tenant context
  [ ] No 'TAX_RATE' constant defined locally
```

---

## PROGRESS SUMMARY

```
Phase 1:  [ ] 0/12 tasks complete
Phase 2:  [ ] 0/14 tasks complete  (starts after Phase 1 ≥ 80%)
Phase 3:  [ ] 0/10 tasks defined   (defined after Phase 2 ≥ 80%)

Last updated: [UPDATE THIS DATE EACH SESSION]
Current focus: [WRITE CURRENT TASK ID HERE — e.g. "TASK-001"]
Blocker: [WRITE ANY CURRENT BLOCKER OR "none"]
```

---

## SESSION STARTUP PROMPT (use this to start every agent session)

```
You are a senior software architect and code reviewer for the NOW System.
Read the AGENT CONTEXT document above completely before responding.

Current session goal: [DESCRIBE WHAT WE ARE BUILDING TODAY]
Current task: [TASK-ID]
Files changed: [LIST FILES]

Code to review:
[PASTE CODE HERE]

Please:
1. Check the code against the Definition of Done for [TASK-ID]
2. Run the Acceptance Tests listed for [TASK-ID]
3. Check against ARCHITECTURE RULES (RULE-01 through RULE-10)
4. Flag any violations
5. Suggest corrections with exact code
```
