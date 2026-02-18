-- ============================================================================
-- NOW System — Schema Baseline Snapshot
-- Generated: 2026-02-18
-- Covers: 336 migrations through 20260217300000_cpq_audit_log.sql
-- Purpose: Quick reference for agents to understand current DB schema
-- ============================================================================

-- ============================================================================
-- CORE CRM TABLES
-- ============================================================================

-- parties: Core entity table (people and organizations unified)
-- Key columns: id (UUID PK), tenant_id, party_type ('person'|'organization'),
--              display_name, status, custom_fields (JSONB), created_at
-- RLS: tenant_id isolation

-- people: Person-specific fields
-- Key columns: id (UUID PK → parties.id), first_name, last_name, email, phone

-- organizations_ext: Organization-specific fields (renamed to avoid conflicts)
-- Key columns: id (UUID PK → parties.id), org_name, industry, size_range

-- cards: Denormalized view of party data for fast grid queries
-- Key columns: ret_id, ret_name, ret_type, ret_email, ret_phone, 
--              ret_status, ret_tenant_id, contact_methods (JSONB)
-- Partitioned by hash on ret_id (256 partitions)

-- party_memberships: M:N relationships between parties
-- Key columns: id, person_id → parties, organization_id → parties,
--              role, status, metadata (JSONB), start_date, end_date

-- entity_relationships: Generic relationship system
-- Key columns: source_id, target_id, relationship_type_id, metadata (JSONB)

-- relationship_types: Defines available relationship types

-- ============================================================================
-- AUTH & TENANCY
-- ============================================================================

-- profiles: User profiles linked to auth.users
-- Key columns: id (UUID → auth.users.id), tenant_id, full_name

-- tenant_members: Maps users to tenants with roles
-- Key columns: user_id, tenant_id, role

-- permissions, role_permissions, user_roles: RBAC system

-- ============================================================================
-- CPQ (Configure, Price, Quote)
-- ============================================================================

-- product_templates: Configuration templates
-- Key columns: id, tenant_id, name, description, base_price,
--              display_mode ('single_page'|'wizard'), is_active, image_url

-- option_groups: Groups of configurable options within a template
-- Key columns: id, template_id, name, selection_type ('single'|'multiple'),
--              is_required, min_selections, max_selections,
--              source_type ('manual'|'category'), source_category_id

-- options: Individual configuration options
-- Key columns: id, group_id, name, sku, product_id,
--              price_modifier_type ('add'|'multiply'|'replace'),
--              price_modifier_amount, is_default, is_available, image_url

-- option_overrides: Per-product price overrides for category-sourced options
-- Key columns: id, group_id, product_id, custom price/availability

-- configuration_rules: Business rules (requires, conflicts, hides, auto_select)
-- Key columns: id, template_id, rule_type, if_option_id, if_group_id,
--              then_option_id, then_group_id, priority, error_message

-- template_presets: Pre-built configurations
-- Key columns: id, template_id, name, selected_options (JSONB)

-- configurations: Saved user configurations
-- Key columns: id, template_id, tenant_id, selected_options (JSONB),
--              total_price, status ('draft'|'completed'), source_snapshot (JSONB)

-- configured_products: Resolved products from configurations

-- ============================================================================
-- PRODUCTS & INVENTORY
-- ============================================================================

-- product_categories: Hierarchical product categories
-- Key columns: id, tenant_id, name, parent_id, path (ltree)

-- products: Product catalog
-- Key columns: id, tenant_id, category_id, name, sku, list_price, cost_price

-- inventory_ledger: Stock movements
-- inventory_reservations: Stock reservations for orders

-- ============================================================================
-- SALES
-- ============================================================================

-- orders: Sales orders
-- order_items: Line items within orders
-- invoices: Invoices linked to orders

-- ============================================================================
-- ATTRIBUTES & OPTIONS
-- ============================================================================

-- attribute_definitions: Dynamic attribute system
-- option_sets: Reusable option sets (e.g., status values)
-- option_values: Values within option sets

-- ============================================================================
-- AUDIT & VIEWS
-- ============================================================================

-- audit_logs: General audit trail
-- admin_audit_log: Admin-specific audit (monthly partitioned)
-- cpq_audit_log: CPQ-specific audit (triggers on template/group/option/rule changes)
-- action_timeline: User action timeline
-- saved_views: User-saved grid/filter configurations
-- unique_identifiers: Used for generating unique codes/IDs

-- ============================================================================
-- JSONB FIELD SCHEMAS (Important for validation)
-- ============================================================================

-- selected_options: Record<group_uuid, option_uuid | option_uuid[]>
-- custom_fields: Record<string, any> — dynamic per-entity fields
-- contact_methods: { type: string, value: string, is_primary: boolean }[]
-- metadata (party_memberships): { title?: string, department?: string, ... }
-- source_snapshot (configurations): Full template snapshot at time of config
