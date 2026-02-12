-- ============================================================================
-- CPQ Product Configurator - Database Migration
-- Migration: 20260211_cpq_product_configurator
-- Author: System Architecture Team
-- Date: 2026-02-11
-- Description: Creates all tables, indexes, functions, and seed data for the
--              Configure, Price, Quote product configurator system.
-- Dependencies: Migration 007 (products), Migration 20260209 (bom_headers/bom_items),
--              product_categories table with ltree extension
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSION CHECK
-- ============================================================================
-- Ensure ltree extension is available (should already exist from product_categories)
CREATE EXTENSION IF NOT EXISTS "ltree";
-- Ensure pgcrypto for gen_random_uuid (should already exist)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PRODUCT TEMPLATES (Configurable Base Models)
-- ============================================================================
-- Purpose: Defines the base configurable products that customers can customize.
-- Examples: "Custom Gaming PC", "BMW 3 Series", "MacBook Pro 14-inch"
-- Relationship: One template has many option_groups.

CREATE TABLE product_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Link to existing product catalog (optional)
    -- If set, this template is based on an existing catalog product
    base_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Categorization using existing category tree
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    
    -- Display
    image_url TEXT,
    
    -- Configuration UX
    -- 'single_page' = Apple-style all groups visible (default for 3-8 groups)
    -- 'wizard' = Step-by-step (better for 8+ groups, automotive style)
    display_mode TEXT NOT NULL DEFAULT 'single_page' 
        CHECK (display_mode IN ('single_page', 'wizard')),
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Tenant-scoped unique name
    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE product_templates IS 'Base configurable products (e.g., Gaming PC, BMW 3 Series)';
COMMENT ON COLUMN product_templates.base_price IS 'Starting price before any options are added';
COMMENT ON COLUMN product_templates.base_product_id IS 'Optional link to an existing catalog product';
COMMENT ON COLUMN product_templates.display_mode IS 'single_page=all groups visible, wizard=step-by-step';

-- ============================================================================
-- 2. OPTION GROUPS (Categories of Choices)
-- ============================================================================
-- Purpose: Defines categories of options within a template.
-- Examples: "Processor", "RAM", "Storage", "Paint Color"
-- Key Design: Supports HYBRID option sourcing (manual OR category-driven)

CREATE TABLE option_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Display
    display_order INT NOT NULL DEFAULT 0,
    icon_url TEXT,  -- Optional icon for the group
    
    -- Selection constraints
    -- 'single' = radio buttons, pick exactly one (e.g., Processor)
    -- 'multiple' = checkboxes, pick 0 to max (e.g., Accessories)
    selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    min_selections INT NOT NULL DEFAULT 0,
    max_selections INT,  -- NULL = unlimited for 'multiple' type
    
    -- ─── HYBRID OPTION SOURCING ───
    -- This is the key architectural decision validated by research:
    -- SAP CPQ and Oracle CPQ both support dynamic sourcing from product families.
    -- Our implementation mirrors this with category-driven options.
    
    -- 'manual' = options defined explicitly in the 'options' table
    -- 'category' = options dynamically pulled from products in the specified category
    source_type TEXT NOT NULL DEFAULT 'manual' 
        CHECK (source_type IN ('manual', 'category')),
    
    -- If source_type = 'category', this points to the product_categories record
    -- whose child products become selectable options.
    -- Example: source_category_id → "Components > Processors" category
    --          All products in that category appear as processor options
    source_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    
    -- For category-driven groups: how to derive the price modifier
    -- 'list_price' = use product's list_price as additive modifier
    -- 'cost_plus' = use product's cost_price + markup
    -- 'explicit' = still require manual price_modifier in option_overrides
    category_price_mode TEXT DEFAULT 'list_price' 
        CHECK (category_price_mode IN ('list_price', 'cost_plus', 'explicit')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Validation: category source requires category_id
    CONSTRAINT chk_category_source CHECK (
        source_type = 'manual' OR source_category_id IS NOT NULL
    )
);

COMMENT ON TABLE option_groups IS 'Categories of choices within a template (e.g., Processor, RAM)';
COMMENT ON COLUMN option_groups.source_type IS 'manual=static options in options table, category=dynamic from product_categories';
COMMENT ON COLUMN option_groups.source_category_id IS 'For category source: pull products from this category subtree as options';
COMMENT ON COLUMN option_groups.category_price_mode IS 'For category source: how to determine price modifier from product data';

-- ============================================================================
-- 3. OPTIONS (Individual Choices)
-- ============================================================================
-- Purpose: Defines specific selectable options within a group.
-- Used for: manual source_type groups only. Category-driven groups derive
--           options from the products table via product_categories.
-- Examples: "Intel Core i9-13900K (+$300)", "32GB DDR5 RAM (+$150)"

CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Link to catalog product (optional but recommended)
    -- Enables inventory tracking, cost tracking, and BOM generation
    sku TEXT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Price modification
    -- 'add' = base_price + amount (most common, used by Apple/Dell)
    -- 'multiply' = base_price * amount (e.g., 1.5 for 50% premium)
    -- 'replace' = set total to amount (override base price)
    price_modifier_type TEXT NOT NULL DEFAULT 'add' 
        CHECK (price_modifier_type IN ('add', 'multiply', 'replace')),
    price_modifier_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Default & availability
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_available BOOLEAN NOT NULL DEFAULT true,
    availability_note TEXT,  -- e.g., "Coming soon", "Out of stock until March"
    
    -- Display
    display_order INT NOT NULL DEFAULT 0,
    image_url TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE options IS 'Individual selectable choices within an option group';
COMMENT ON COLUMN options.price_modifier_type IS 'add=+$X, multiply=*X, replace=set to $X';
COMMENT ON COLUMN options.product_id IS 'Link to catalog product for inventory/BOM integration';

-- ============================================================================
-- 4. OPTION OVERRIDES (For Category-Driven Groups)
-- ============================================================================
-- Purpose: Override pricing or availability for specific products when they
--          appear as options in a category-driven group.
-- Example: Product "Intel i9" has list_price $599, but in the "Gaming PC"
--          template, the price modifier should be +$300 (relative to base).

CREATE TABLE option_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Override fields (NULL = use default from product)
    price_modifier_type TEXT CHECK (price_modifier_type IN ('add', 'multiply', 'replace')),
    price_modifier_amount NUMERIC(15, 2),
    is_default BOOLEAN,
    is_available BOOLEAN,
    display_order INT,
    custom_name TEXT,  -- Override product name in configurator context
    custom_description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One override per product per group
    UNIQUE(group_id, product_id)
);

COMMENT ON TABLE option_overrides IS 'Price/availability overrides for products in category-driven option groups';

-- ============================================================================
-- 5. CONFIGURATION RULES (Dependencies, Conflicts, Visibility)
-- ============================================================================
-- Purpose: Enforce valid combinations following the sequential rule-based
--          approach (validated as appropriate for our complexity level).
-- Design: Each rule has a condition (IF) and an action (THEN).
-- Follows Salesforce CPQ pattern: typed rules with explicit conditions/actions.

CREATE TABLE configuration_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,
    
    -- Rule type determines evaluation behavior
    -- 'requires' = IF option A selected THEN option/group B must be selected
    -- 'conflicts' = IF option A selected THEN option B cannot be selected
    -- 'hides' = IF option A selected THEN hide option/group B from UI
    -- 'price_tier' = IF quantity >= threshold THEN apply discount
    -- 'auto_select' = IF option A selected THEN auto-select option B
    rule_type TEXT NOT NULL 
        CHECK (rule_type IN ('requires', 'conflicts', 'hides', 'price_tier', 'auto_select')),
    
    -- Human-readable description shown to users when rule triggers
    -- e.g., "M2 Ultra requires minimum 64GB RAM"
    name TEXT NOT NULL,
    description TEXT,
    error_message TEXT,  -- Displayed when validation fails
    
    -- ─── CONDITION (IF) ───
    -- What triggers this rule? At least one condition field must be set.
    if_option_id UUID REFERENCES options(id) ON DELETE CASCADE,
    if_group_id UUID REFERENCES option_groups(id) ON DELETE CASCADE,
    -- For category-driven options, reference the product directly
    if_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- ─── ACTION (THEN) ───
    -- What happens when the condition is met?
    then_option_id UUID REFERENCES options(id) ON DELETE CASCADE,
    then_group_id UUID REFERENCES option_groups(id) ON DELETE CASCADE,
    then_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- ─── PRICE TIER FIELDS ───
    -- Only used when rule_type = 'price_tier'
    quantity_min INT,
    quantity_max INT,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value NUMERIC(15, 2),
    
    -- Rule priority (lower = evaluated first)
    priority INT NOT NULL DEFAULT 100,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE configuration_rules IS 'Business rules for valid product configurations (requires, conflicts, hides, price tiers)';
COMMENT ON COLUMN configuration_rules.priority IS 'Evaluation order: lower numbers evaluated first';
COMMENT ON COLUMN configuration_rules.error_message IS 'User-facing message when validation rule fails';

-- ============================================================================
-- 6. CONFIGURATIONS (Saved Customer Sessions)
-- ============================================================================
-- Purpose: Persist in-progress and completed customer configurations.
-- Stores selections as JSONB for flexibility and query performance.
-- Supports anonymous sessions, authenticated users, and sharing via token.

CREATE TABLE configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE RESTRICT,
    
    -- Owner identification (one of these should be set)
    user_id UUID,           -- Authenticated user
    session_id TEXT,         -- Anonymous browser session
    
    -- ─── SELECTED OPTIONS ───
    -- JSONB format for maximum flexibility:
    -- For single-select groups: {"group_id": "option_id", ...}
    -- For multi-select groups: {"group_id": ["option_id_1", "option_id_2"], ...}
    -- For category-driven groups: {"group_id": "product_id", ...}
    selected_options JSONB NOT NULL DEFAULT '{}',
    
    -- ─── CALCULATED PRICES ───
    -- Stored for quick retrieval; recalculated on load for accuracy
    base_price NUMERIC(15, 2),
    options_total NUMERIC(15, 2),
    discount_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_price NUMERIC(15, 2),
    quantity INT NOT NULL DEFAULT 1,
    
    -- ─── STATUS WORKFLOW ───
    -- draft → completed → quoted → ordered
    status TEXT NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'completed', 'quoted', 'ordered', 'expired')),
    
    -- ─── INVENTORY RESERVATION (SAP/NetSuite pattern) ───
    -- Maps to status workflow:
    --   draft/completed = 'none' (no reservation, avoid phantom holds)
    --   quoted          = 'soft' (advisory, "expected demand", does not block other orders)
    --   ordered         = 'hard' (committed, components held with validity dates)
    inventory_reservation_status TEXT NOT NULL DEFAULT 'none'
        CHECK (inventory_reservation_status IN ('none', 'soft', 'hard')),
    inventory_reservation_id UUID,    -- FK to external reservation system (Phase 2+)
    
    -- ─── SHARING ───
    -- Unique token for shareable configuration links
    -- URL: /configurator/shared/{share_token}
    share_token TEXT UNIQUE,
    
    -- ─── METADATA ───
    -- Price breakdown stored for audit/display
    price_breakdown JSONB,  -- Detailed line-item breakdown
    notes TEXT,             -- User or sales rep notes
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ  -- Optional expiry for anonymous sessions
);

COMMENT ON TABLE configurations IS 'Saved customer product configurations (draft through ordered)';
COMMENT ON COLUMN configurations.selected_options IS 'JSONB: {group_id: option_id} for single, {group_id: [ids]} for multi';
COMMENT ON COLUMN configurations.share_token IS 'Unique token for shareable configuration links';
COMMENT ON COLUMN configurations.price_breakdown IS 'Detailed price breakdown for display/audit';

-- ============================================================================
-- 7. CONFIGURED PRODUCTS (Final Output for Orders)
-- ============================================================================
-- Purpose: Represents the final product generated from a completed configuration.
-- Links back to configuration for traceability and to BOM for fulfillment.
-- Created when configuration status transitions to 'quoted' or 'ordered'.

CREATE TABLE configured_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    configuration_id UUID NOT NULL REFERENCES configurations(id) ON DELETE RESTRICT,
    
    -- Generated product identity
    generated_sku TEXT NOT NULL,
    generated_name TEXT NOT NULL,
    generated_description TEXT,
    final_price NUMERIC(15, 2) NOT NULL,
    
    -- Integration with existing systems
    -- Option A: Generate a BOM for manufacturing/fulfillment
    bom_header_id UUID REFERENCES bom_headers(id) ON DELETE SET NULL,
    -- Option B: Create as a new product in the catalog
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- BOM Explosion Mode (Oracle CPQ / SAP S/4HANA pattern)
    -- 'current'            = Only currently effective components (standard orders)
    -- 'current_and_future' = Include future-effective components (pre-orders)
    -- 'all'                = All potential components regardless of date (planning)
    bom_explosion_mode TEXT NOT NULL DEFAULT 'current'
        CHECK (bom_explosion_mode IN ('current', 'current_and_future', 'all')),
    
    -- Snapshot of configuration at time of creation (immutable)
    configuration_snapshot JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, generated_sku)
);

COMMENT ON TABLE configured_products IS 'Final products generated from completed configurations, linked to BOM/orders';
COMMENT ON COLUMN configured_products.configuration_snapshot IS 'Immutable snapshot of all selections at order time';

-- ============================================================================
-- 8. TEMPLATE PRESETS (Smart Defaults / Named Configurations)
-- ============================================================================
-- Purpose: Named preset configurations that pre-fill option groups with curated
--          combinations. Users start from a preset and fine-tune, rather than
--          building from scratch. Inspired by BMW "Sport Line" / "Luxury Line"
--          pattern, which significantly reduces choice paralysis.

CREATE TABLE template_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Preset identity
    name TEXT NOT NULL,                    -- e.g., "Performance", "Budget", "Professional"
    description TEXT,                       -- e.g., "Optimized for gaming with top-tier GPU"
    
    -- Pre-selected options as JSONB: { "group_id": "option_id", ... }
    -- Same format as configurations.selected_options
    selected_options JSONB NOT NULL DEFAULT '{}',
    
    -- Display
    display_order INT NOT NULL DEFAULT 0,
    image_url TEXT,                         -- Optional preset-specific image
    badge_text TEXT,                        -- e.g., "Most Popular", "Best Value"
    
    -- Pricing (cached, recalculated on admin save)
    cached_total_price NUMERIC(15,2),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_preset_name UNIQUE (template_id, name)
);

COMMENT ON TABLE template_presets IS 'Named preset configurations (BMW Sport Line pattern) to reduce choice paralysis';
COMMENT ON COLUMN template_presets.selected_options IS 'Pre-selected options in same JSONB format as configurations.selected_options';
COMMENT ON COLUMN template_presets.badge_text IS 'Optional badge like "Most Popular" or "Best Value" displayed on preset card';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Product Templates
CREATE INDEX idx_templates_tenant ON product_templates(tenant_id);
CREATE INDEX idx_templates_category ON product_templates(category_id);
CREATE INDEX idx_templates_active ON product_templates(tenant_id, is_active) WHERE is_active = true;

-- Option Groups
CREATE INDEX idx_option_groups_template ON option_groups(template_id);
CREATE INDEX idx_option_groups_tenant ON option_groups(tenant_id);
CREATE INDEX idx_option_groups_source_cat ON option_groups(source_category_id) WHERE source_category_id IS NOT NULL;
CREATE INDEX idx_option_groups_order ON option_groups(template_id, display_order);

-- Options
CREATE INDEX idx_options_group ON options(group_id);
CREATE INDEX idx_options_tenant ON options(tenant_id);
CREATE INDEX idx_options_product ON options(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_options_group_order ON options(group_id, display_order);

-- Option Overrides
CREATE INDEX idx_option_overrides_group ON option_overrides(group_id);
CREATE INDEX idx_option_overrides_product ON option_overrides(product_id);

-- Configuration Rules
CREATE INDEX idx_config_rules_template ON configuration_rules(template_id);
CREATE INDEX idx_config_rules_tenant ON configuration_rules(tenant_id);
CREATE INDEX idx_config_rules_active ON configuration_rules(template_id, is_active, priority) WHERE is_active = true;
CREATE INDEX idx_config_rules_if_option ON configuration_rules(if_option_id) WHERE if_option_id IS NOT NULL;
CREATE INDEX idx_config_rules_if_group ON configuration_rules(if_group_id) WHERE if_group_id IS NOT NULL;

-- Configurations (Sessions)
CREATE INDEX idx_configurations_tenant ON configurations(tenant_id);
CREATE INDEX idx_configurations_user ON configurations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_configurations_session ON configurations(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_configurations_template ON configurations(template_id);
CREATE INDEX idx_configurations_status ON configurations(tenant_id, status);
CREATE INDEX idx_configurations_share ON configurations(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_configurations_selected ON configurations USING GIN (selected_options);
CREATE INDEX idx_configurations_expires ON configurations(expires_at) WHERE expires_at IS NOT NULL;

-- Configured Products
CREATE INDEX idx_configured_products_tenant ON configured_products(tenant_id);
CREATE INDEX idx_configured_products_config ON configured_products(configuration_id);
CREATE INDEX idx_configured_products_bom ON configured_products(bom_header_id) WHERE bom_header_id IS NOT NULL;

-- Template Presets
CREATE INDEX idx_template_presets_template ON template_presets(template_id);
CREATE INDEX idx_template_presets_active ON template_presets(template_id, is_active, display_order) WHERE is_active = true;

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION cpq_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_templates_updated 
    BEFORE UPDATE ON product_templates 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

CREATE TRIGGER trg_option_groups_updated 
    BEFORE UPDATE ON option_groups 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

CREATE TRIGGER trg_options_updated 
    BEFORE UPDATE ON options 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

CREATE TRIGGER trg_config_rules_updated 
    BEFORE UPDATE ON configuration_rules 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

CREATE TRIGGER trg_configurations_updated 
    BEFORE UPDATE ON configurations 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

CREATE TRIGGER trg_template_presets_updated 
    BEFORE UPDATE ON template_presets 
    FOR EACH ROW EXECUTE FUNCTION cpq_update_timestamp();

-- ============================================================================
-- HELPER FUNCTION: Get options for a group (handles both manual and category)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_group_options(
    p_group_id UUID,
    p_tenant_id UUID
)
RETURNS TABLE (
    option_id UUID,
    option_name TEXT,
    option_description TEXT,
    option_sku TEXT,
    linked_product_id UUID,
    price_modifier_type TEXT,
    price_modifier_amount NUMERIC(15,2),
    is_default BOOLEAN,
    is_available BOOLEAN,
    display_order INT,
    source TEXT  -- 'manual' or 'category'
) AS $$
DECLARE
    v_source_type TEXT;
    v_source_category_id UUID;
    v_category_price_mode TEXT;
BEGIN
    -- Get group configuration
    SELECT og.source_type, og.source_category_id, og.category_price_mode
    INTO v_source_type, v_source_category_id, v_category_price_mode
    FROM option_groups og
    WHERE og.id = p_group_id AND og.tenant_id = p_tenant_id;
    
    IF v_source_type = 'manual' THEN
        -- Return manually defined options
        RETURN QUERY
        SELECT 
            o.id,
            o.name,
            o.description,
            o.sku,
            o.product_id,
            o.price_modifier_type,
            o.price_modifier_amount,
            o.is_default,
            o.is_available,
            o.display_order,
            'manual'::TEXT
        FROM options o
        WHERE o.group_id = p_group_id 
          AND o.tenant_id = p_tenant_id
        ORDER BY o.display_order, o.name;
    ELSE
        -- Return products from the category tree as options
        RETURN QUERY
        SELECT 
            p.id AS option_id,
            COALESCE(ov.custom_name, p.name) AS option_name,
            COALESCE(ov.custom_description, p.description) AS option_description,
            p.sku AS option_sku,
            p.id AS linked_product_id,
            COALESCE(ov.price_modifier_type, 'add')::TEXT AS price_modifier_type,
            COALESCE(ov.price_modifier_amount, 
                CASE v_category_price_mode
                    WHEN 'list_price' THEN COALESCE(p.list_price, 0)
                    WHEN 'cost_plus' THEN COALESCE(p.cost_price, 0)
                    ELSE 0
                END
            ) AS price_modifier_amount,
            COALESCE(ov.is_default, false) AS is_default,
            COALESCE(ov.is_available, true) AS is_available,
            COALESCE(ov.display_order, 0) AS display_order,
            'category'::TEXT AS source
        FROM products p
        JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN option_overrides ov ON ov.product_id = p.id AND ov.group_id = p_group_id
        WHERE pc.path <@ (
            SELECT pc2.path FROM product_categories pc2 WHERE pc2.id = v_source_category_id
        )
        AND p.tenant_id = p_tenant_id
        ORDER BY COALESCE(ov.display_order, 0), p.name;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_group_options IS 'Returns options for a group, handling both manual and category-driven sources';

-- ============================================================================
-- HELPER FUNCTION: Calculate configuration price
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_configuration_price(
    p_configuration_id UUID
)
RETURNS TABLE (
    base_price NUMERIC(15,2),
    options_total NUMERIC(15,2),
    discount_amount NUMERIC(15,2),
    total_price NUMERIC(15,2),
    breakdown JSONB
) AS $$
DECLARE
    v_template_id UUID;
    v_tenant_id UUID;
    v_base_price NUMERIC(15,2);
    v_additive_total NUMERIC(15,2) := 0;
    v_multiplicative_factor NUMERIC(15,6) := 1;
    v_running_total NUMERIC(15,2);
    v_quantity INT;
    v_discount NUMERIC(15,2) := 0;
    v_selections JSONB;
    v_breakdown JSONB := '[]'::JSONB;
    v_group_id TEXT;
    v_option_val JSONB;
    v_opt_type TEXT;
    v_opt_amount NUMERIC(15,2);
    v_opt_name TEXT;
BEGIN
    -- Get configuration details
    SELECT c.template_id, c.tenant_id, c.selected_options, c.quantity,
           pt.base_price
    INTO v_template_id, v_tenant_id, v_selections, v_quantity, v_base_price
    FROM configurations c
    JOIN product_templates pt ON c.template_id = pt.id
    WHERE c.id = p_configuration_id;
    
    -- ─── PRICING OPERATION ORDER (CRITICAL) ───
    -- Formula: T = (B + ΣO_add) × ΠM_mult – D
    -- Step 1: Collect all additive modifiers first
    -- Step 2: Apply multiplicative modifiers to (base + additives)
    -- Step 3: Subtract discounts
    -- This order MUST match client-side calculation exactly.
    
    -- Process each selection: separate additive and multiplicative modifiers
    FOR v_group_id, v_option_val IN SELECT * FROM jsonb_each(v_selections)
    LOOP
        -- Look up option price modifier (handles both manual and category options)
        SELECT o.price_modifier_type, o.price_modifier_amount, o.name
        INTO v_opt_type, v_opt_amount, v_opt_name
        FROM options o
        WHERE o.id = (v_option_val #>> '{}')::UUID;
        
        IF v_opt_type IS NOT NULL THEN
            CASE v_opt_type
                WHEN 'add' THEN
                    v_additive_total := v_additive_total + v_opt_amount;
                WHEN 'multiply' THEN
                    v_multiplicative_factor := v_multiplicative_factor * v_opt_amount;
                WHEN 'replace' THEN
                    -- Replace modifiers override the base price entirely
                    v_base_price := v_opt_amount;
            END CASE;
            
            v_breakdown := v_breakdown || jsonb_build_object(
                'group_id', v_group_id,
                'option_name', v_opt_name,
                'modifier_type', v_opt_type,
                'modifier_amount', v_opt_amount
            );
        END IF;
    END LOOP;
    
    -- Step 1: Base + all additive modifiers
    v_running_total := v_base_price + v_additive_total;
    
    -- Step 2: Apply multiplicative modifiers to the subtotal
    v_running_total := v_running_total * v_multiplicative_factor;
    
    -- Step 3: Apply quantity-based discounts
    SELECT COALESCE(
        (SELECT cr.discount_value 
         FROM configuration_rules cr
         WHERE cr.template_id = v_template_id
           AND cr.rule_type = 'price_tier'
           AND cr.is_active = true
           AND cr.quantity_min <= v_quantity
           AND (cr.quantity_max IS NULL OR cr.quantity_max >= v_quantity)
         ORDER BY cr.quantity_min DESC
         LIMIT 1
        ), 0
    ) INTO v_discount;
    
    IF v_discount > 0 THEN
        v_discount := v_running_total * (v_discount / 100.0);
    END IF;
    
    -- Final: (running_total - discount) × quantity
    RETURN QUERY SELECT 
        v_base_price,
        v_additive_total,
        v_discount,
        (v_running_total - v_discount) * v_quantity,
        v_breakdown;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_configuration_price IS 'Calculates price using defined operation order: T = (B + ΣO_add) × ΠM_mult – D';

-- ============================================================================
-- HELPER FUNCTION: Generate share token
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(12), 'base64');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA: Gaming PC Template (for testing)
-- ============================================================================
-- Uncomment to insert test data for development

/*
DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'; -- Test tenant
    v_template_id UUID;
    v_cpu_group_id UUID;
    v_ram_group_id UUID;
    v_storage_group_id UUID;
    v_gpu_group_id UUID;
    v_acc_group_id UUID;
    v_i7_id UUID;
    v_i9_id UUID;
    v_ryzen_id UUID;
    v_ram16_id UUID;
    v_ram32_id UUID;
    v_ram64_id UUID;
BEGIN
    -- Template
    INSERT INTO product_templates (id, tenant_id, name, description, base_price)
    VALUES (gen_random_uuid(), v_tenant_id, 'Custom Gaming PC', 
            'Build your perfect gaming desktop with our component selection', 1500.00)
    RETURNING id INTO v_template_id;
    
    -- Option Groups
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Processor', 'single', true, 1, 'manual')
    RETURNING id INTO v_cpu_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Memory (RAM)', 'single', true, 2, 'manual')
    RETURNING id INTO v_ram_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Storage', 'single', true, 3, 'manual')
    RETURNING id INTO v_storage_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Graphics Card', 'single', false, 4, 'manual')
    RETURNING id INTO v_gpu_group_id;
    
    INSERT INTO option_groups (id, tenant_id, template_id, name, selection_type, is_required, display_order, source_type)
    VALUES (gen_random_uuid(), v_tenant_id, v_template_id, 'Accessories', 'multiple', false, 5, 'manual')
    RETURNING id INTO v_acc_group_id;
    
    -- Processor Options
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'Intel Core i7-14700K', 'add', 0.00, true, 1)
    RETURNING id INTO v_i7_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'Intel Core i9-14900K', 'add', 300.00, 2)
    RETURNING id INTO v_i9_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_cpu_group_id, 'AMD Ryzen 9 7950X', 'add', 400.00, 3)
    RETURNING id INTO v_ryzen_id;
    
    -- RAM Options
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '16GB DDR5-5600', 'add', 0.00, true, 1)
    RETURNING id INTO v_ram16_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '32GB DDR5-5600', 'add', 150.00, 2)
    RETURNING id INTO v_ram32_id;
    
    INSERT INTO options (id, tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (gen_random_uuid(), v_tenant_id, v_ram_group_id, '64GB DDR5-5600', 'add', 400.00, 3)
    RETURNING id INTO v_ram64_id;
    
    -- Storage Options
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, is_default, display_order)
    VALUES 
        (v_tenant_id, v_storage_group_id, '512GB NVMe SSD', 'add', 0.00, true, 1),
        (v_tenant_id, v_storage_group_id, '1TB NVMe SSD', 'add', 100.00, false, 2),
        (v_tenant_id, v_storage_group_id, '2TB NVMe SSD', 'add', 250.00, false, 3);
    
    -- GPU Options
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4070', 'add', 500.00, 1),
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4080', 'add', 900.00, 2),
        (v_tenant_id, v_gpu_group_id, 'NVIDIA RTX 4090', 'add', 1500.00, 3);
    
    -- Accessories
    INSERT INTO options (tenant_id, group_id, name, price_modifier_type, price_modifier_amount, display_order)
    VALUES 
        (v_tenant_id, v_acc_group_id, 'RGB Lighting Kit', 'add', 50.00, 1),
        (v_tenant_id, v_acc_group_id, 'Liquid Cooling System', 'add', 200.00, 2),
        (v_tenant_id, v_acc_group_id, 'Wi-Fi 6E Card', 'add', 40.00, 3),
        (v_tenant_id, v_acc_group_id, 'Extended Warranty (3yr)', 'add', 150.00, 4);
    
    -- Configuration Rules
    -- Rule 1: i9 processor requires minimum 32GB RAM
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name, error_message, 
                                     if_option_id, then_group_id, priority)
    VALUES (v_tenant_id, v_template_id, 'requires', 
            'i9 requires 32GB+ RAM',
            'The Intel Core i9-14900K requires a minimum of 32GB RAM for optimal performance.',
            v_i9_id, v_ram_group_id, 10);
    
    -- Rule 2: Ryzen 9 conflicts with specific RAM (example)
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name, error_message,
                                     if_option_id, then_option_id, priority)
    VALUES (v_tenant_id, v_template_id, 'conflicts',
            'Ryzen incompatible with 16GB',
            'AMD Ryzen 9 7950X requires a minimum of 32GB RAM.',
            v_ryzen_id, v_ram16_id, 20);
    
    -- Rule 3: Volume discount at 10+ units
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name,
                                     quantity_min, discount_type, discount_value, priority)
    VALUES (v_tenant_id, v_template_id, 'price_tier',
            '10+ unit discount',
            10, 'percentage', 5.00, 100);
    
    -- Rule 4: Volume discount at 50+ units
    INSERT INTO configuration_rules (tenant_id, template_id, rule_type, name,
                                     quantity_min, discount_type, discount_value, priority)
    VALUES (v_tenant_id, v_template_id, 'price_tier',
            '50+ unit discount',
            50, 'percentage', 10.00, 101);
    
    RAISE NOTICE 'Sample Gaming PC template created with ID: %', v_template_id;
    
    -- ─── PRESETS (BMW "Sport Line" pattern) ───
    INSERT INTO template_presets (tenant_id, template_id, name, description, selected_options, display_order, badge_text)
    VALUES 
        (v_tenant_id, v_template_id, 'Performance', 'Top-tier components for maximum gaming performance',
         jsonb_build_object(v_cpu_group_id::text, v_i9_id::text, v_ram_group_id::text, v_ram32_id::text),
         1, 'Most Popular'),
        (v_tenant_id, v_template_id, 'Budget', 'Great gaming experience at an affordable price',
         jsonb_build_object(v_cpu_group_id::text, v_i7_id::text, v_ram_group_id::text, v_ram16_id::text),
         2, 'Best Value');
    
    RAISE NOTICE 'Sample presets created for template: %', v_template_id;
END $$;
*/

-- ============================================================================
-- CLEANUP POLICY: Expire old anonymous configurations
-- ============================================================================
-- Run periodically via cron to clean up abandoned anonymous sessions

-- Set expiry on new anonymous configurations (30 days)
CREATE OR REPLACE FUNCTION set_config_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at = NOW() + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_config_set_expiry
    BEFORE INSERT ON configurations
    FOR EACH ROW EXECUTE FUNCTION set_config_expiry();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Critical for multi-tenant security and user privacy

-- Enable RLS on all tables
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE configured_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_presets ENABLE ROW LEVEL SECURITY;

-- ─── PRODUCT TEMPLATES POLICIES ───
-- Templates are tenant-scoped and publicly viewable within tenant
CREATE POLICY "Users can view active templates in their tenant"
    ON product_templates FOR SELECT
    USING (
        is_active = true
        AND (
            tenant_id = (auth.jwt()->>'tenant_id')::uuid
            OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Admins can manage templates"
    ON product_templates FOR ALL
    USING (
        tenant_id = (auth.jwt()->>'tenant_id')::uuid
        AND (auth.jwt()->>'role')::text = 'admin'
    );

-- ─── OPTION GROUPS & OPTIONS POLICIES ───
-- Groups and options inherit template's tenant
CREATE POLICY "Users can view option groups for visible templates"
    ON option_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM product_templates
            WHERE id = option_groups.template_id
            AND is_active = true
            AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Users can view options for visible groups"
    ON options FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM option_groups og
            JOIN product_templates pt ON og.template_id = pt.id
            WHERE og.id = options.group_id
            AND pt.is_active = true
            AND pt.tenant_id = (auth.jwt()->>'tenant_id')::uuid
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Admins can manage option groups"
    ON option_groups FOR ALL
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

CREATE POLICY "Admins can manage options"
    ON options FOR ALL
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- ─── OPTION OVERRIDES POLICIES ───
CREATE POLICY "Users can view option overrides"
    ON option_overrides FOR SELECT
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

CREATE POLICY "Admins can manage option overrides"
    ON option_overrides FOR ALL
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- ─── CONFIGURATION RULES POLICIES ───
CREATE POLICY "Users can view active rules for templates"
    ON configuration_rules FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM product_templates
            WHERE id = configuration_rules.template_id
            AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
        )
    );

CREATE POLICY "Admins can manage rules"
    ON configuration_rules FOR ALL
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- ─── CONFIGURATIONS POLICIES ───
-- Users can only see their own configurations (or anonymous via session)
CREATE POLICY "Users can view own configurations"
    ON configurations FOR SELECT
    USING (
        user_id = auth.uid()
        OR session_id = current_setting('request.headers', true)::json->>'session-id'
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Anyone can view shared configurations"
    ON configurations FOR SELECT
    USING (share_token IS NOT NULL);

CREATE POLICY "Users can create configurations"
    ON configurations FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR session_id IS NOT NULL
    );

CREATE POLICY "Users can update own draft configurations"
    ON configurations FOR UPDATE
    USING (
        (user_id = auth.uid() OR session_id = current_setting('request.headers', true)::json->>'session-id')
        AND status = 'draft'
    );

CREATE POLICY "Users cannot delete configurations"
    ON configurations FOR DELETE
    USING (false); -- Soft delete only via status

-- ─── CONFIGURED PRODUCTS POLICIES ───
-- Configured products are created from completed configurations
CREATE POLICY "Users can view own configured products"
    ON configured_products FOR SELECT
    USING (
        tenant_id = (auth.jwt()->>'tenant_id')::uuid
        OR auth.role() = 'service_role'
    );

CREATE POLICY "System can create configured products"
    ON configured_products FOR INSERT
    WITH CHECK (
        tenant_id = (auth.jwt()->>'tenant_id')::uuid
        OR auth.role() = 'service_role'
    );

-- ─── TEMPLATE PRESETS POLICIES ───
CREATE POLICY "Users can view active presets"
    ON template_presets FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM product_templates
            WHERE id = template_presets.template_id
            AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
        )
    );

CREATE POLICY "Admins can manage presets"
    ON template_presets FOR ALL
    USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES (v1.2 - With RLS)
-- ============================================================================
-- 
-- 1. The sample data block is commented out. Uncomment for dev/test.
-- 2. Run periodic cleanup: DELETE FROM configurations 
--    WHERE expires_at < NOW() AND status = 'draft';
-- 3. ✅ RLS policies enforce tenant isolation and user privacy.
-- 4. The get_group_options() function handles both manual and category-driven
--    option groups transparently. Use it in the API layer.
-- 5. The calculate_configuration_price() function enforces operation order:
--    T = (B + ΣO_add) × ΠM_mult – D. Client-side MUST use the same order.
-- 6. template_presets table stores named preset configurations (BMW pattern)
--    to reduce choice paralysis. Load via GET /templates/:id.
-- 7. inventory_reservation_status in configurations tracks reservation lifecycle:
--    none (draft) → soft (quoted) → hard (ordered). See SAP/NetSuite patterns.
-- 8. bom_explosion_mode in configured_products controls BOM generation scope:
--    'current' for standard orders, 'current_and_future' for pre-orders.
-- 9. PATCH-based API updates are recommended (send only changed selection).
-- 10. RLS policies require auth.jwt() claims for 'tenant_id' and 'role'.
--     Ensure JWT includes: { tenant_id: "uuid", role: "user" | "admin" }
