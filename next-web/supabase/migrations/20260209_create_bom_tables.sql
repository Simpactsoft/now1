-- ============================================================================
-- BOM (Bill of Materials) Schema
-- Purpose: Support composite products with hierarchical assembly structures
-- Example: Desktop PC with motherboard assembly, memory kit, storage assembly
-- ============================================================================

-- ============================================================================
-- 1. BOM Headers Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bom_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL,
    version VARCHAR(10) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'OBSOLETE')),
    effective_date DATE DEFAULT CURRENT_DATE,
    obsolete_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_bom_headers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_headers_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT uq_bom_product_version UNIQUE(product_id, version),
    CONSTRAINT chk_bom_dates CHECK (obsolete_date IS NULL OR obsolete_date >= effective_date)
);

COMMENT ON TABLE bom_headers IS 'Bill of Materials headers - one per product version';
COMMENT ON COLUMN bom_headers.version IS 'BOM version (e.g., 1.0, 2.0) - allows multiple BOMs per product';
COMMENT ON COLUMN bom_headers.effective_date IS 'Date when this BOM becomes active';
COMMENT ON COLUMN bom_headers.obsolete_date IS 'Date when this BOM is no longer used';

-- ============================================================================
-- 2. BOM Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    bom_header_id UUID NOT NULL,
    parent_item_id UUID,
    component_product_id UUID NOT NULL,
    level INT NOT NULL DEFAULT 0 CHECK (level >= 0),
    sequence INT DEFAULT 0,
    quantity DECIMAL(10,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit VARCHAR(10) DEFAULT 'EA',
    scrap_factor DECIMAL(5,4) DEFAULT 0 CHECK (scrap_factor >= 0 AND scrap_factor < 1),
    is_assembly BOOLEAN DEFAULT FALSE,
    is_phantom BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_bom_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_items_header FOREIGN KEY (bom_header_id) REFERENCES bom_headers(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_items_parent FOREIGN KEY (parent_item_id) REFERENCES bom_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_items_component FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE RESTRICT
);

COMMENT ON TABLE bom_items IS 'BOM line items - components and sub-assemblies';
COMMENT ON COLUMN bom_items.level IS 'Hierarchy level: 0=root, 1=sub-assembly, 2=component, etc.';
COMMENT ON COLUMN bom_items.parent_item_id IS 'NULL for root level, otherwise references parent assembly';
COMMENT ON COLUMN bom_items.scrap_factor IS 'Waste percentage (0.05 = 5% waste)';
COMMENT ON COLUMN bom_items.is_assembly IS 'TRUE if this item has child components';
COMMENT ON COLUMN bom_items.is_phantom IS 'TRUE for logical groupings that don''t exist in inventory';

-- ============================================================================
-- 3. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bom_headers_tenant ON bom_headers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_product ON bom_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_status ON bom_headers(status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_bom_items_tenant ON bom_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_header ON bom_items(bom_header_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_parent ON bom_items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_component ON bom_items(component_product_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_level ON bom_items(level);

-- ============================================================================
-- 4. RLS Policies
-- ============================================================================
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- BOM Headers Policies
CREATE POLICY bom_headers_tenant_isolation ON bom_headers
    FOR ALL
    TO authenticated
    USING (tenant_id = get_current_tenant_id());

-- BOM Items Policies
CREATE POLICY bom_items_tenant_isolation ON bom_items
    FOR ALL
    TO authenticated
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 5. Costing View (Recursive CTE)
-- ============================================================================
CREATE OR REPLACE VIEW bom_costing_view AS
WITH RECURSIVE bom_tree AS (
    -- Root level items
    SELECT 
        bi.id,
        bi.tenant_id,
        bi.bom_header_id,
        bi.parent_item_id,
        bi.component_product_id,
        bi.level,
        bi.quantity,
        bi.is_assembly,
        bi.is_phantom,
        p.sku,
        p.name,
        p.cost_price,
        p.list_price,
        bi.quantity::DECIMAL AS total_quantity,
        (bi.quantity * COALESCE(p.cost_price, 0)) AS extended_cost,
        (bi.quantity * COALESCE(p.list_price, 0)) AS extended_price,
        ARRAY[bi.id] AS path,
        0 AS depth
    FROM bom_items bi
    JOIN products p ON bi.component_product_id = p.id
    WHERE bi.parent_item_id IS NULL
    
    UNION ALL
    
    -- Recursive: child items
    SELECT 
        bi.id,
        bi.tenant_id,
        bi.bom_header_id,
        bi.parent_item_id,
        bi.component_product_id,
        bi.level,
        bi.quantity,
        bi.is_assembly,
        bi.is_phantom,
        p.sku,
        p.name,
        p.cost_price,
        p.list_price,
        bi.quantity * bt.total_quantity AS total_quantity,
        (bi.quantity * bt.total_quantity * COALESCE(p.cost_price, 0)) AS extended_cost,
        (bi.quantity * bt.total_quantity * COALESCE(p.list_price, 0)) AS extended_price,
        bt.path || bi.id AS path,
        bt.depth + 1 AS depth
    FROM bom_items bi
    JOIN bom_tree bt ON bi.parent_item_id = bt.id
    JOIN products p ON bi.component_product_id = p.id
    WHERE NOT bi.id = ANY(bt.path) -- Prevent circular references
)
SELECT * FROM bom_tree;

COMMENT ON VIEW bom_costing_view IS 'Recursive view showing BOM tree with cascading quantities and costs';

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function: Get BOM Tree for a Product
CREATE OR REPLACE FUNCTION get_bom_tree(p_product_id UUID, p_version VARCHAR DEFAULT '1.0')
RETURNS TABLE (
    item_id UUID,
    component_id UUID,
    sku VARCHAR,
    name VARCHAR,
    level INT,
    quantity DECIMAL,
    unit_cost DECIMAL,
    extended_cost DECIMAL,
    is_assembly BOOLEAN,
    path TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE bom_tree AS (
        SELECT 
            bi.id AS item_id,
            bi.component_product_id AS component_id,
            p.sku,
            p.name,
            bi.level,
            bi.quantity::DECIMAL,
            p.cost_price AS unit_cost,
            (bi.quantity * COALESCE(p.cost_price, 0)) AS extended_cost,
            bi.is_assembly,
            REPEAT('  ', bi.level) || p.name AS path,
            bi.sequence,
            ARRAY[bi.id] AS id_path
        FROM bom_items bi
        JOIN products p ON bi.component_product_id = p.id
        JOIN bom_headers bh ON bi.bom_header_id = bh.id
        WHERE bh.product_id = p_product_id 
          AND bh.version = p_version
          AND bi.parent_item_id IS NULL
        
        UNION ALL
        
        SELECT 
            bi.id,
            bi.component_product_id,
            p.sku,
            p.name,
            bi.level,
            (bi.quantity * bt.quantity)::DECIMAL,
            p.cost_price,
            (bi.quantity * bt.quantity * COALESCE(p.cost_price, 0)),
            bi.is_assembly,
            bt.path || ' > ' || p.name,
            bi.sequence,
            bt.id_path || bi.id
        FROM bom_items bi
        JOIN bom_tree bt ON bi.parent_item_id = bt.item_id
        JOIN products p ON bi.component_product_id = p.id
        WHERE NOT bi.id = ANY(bt.id_path)
    )
    SELECT 
        item_id,
        component_id,
        sku::VARCHAR,
        name::VARCHAR,
        level,
        quantity,
        unit_cost,
        extended_cost,
        is_assembly,
        path::TEXT
    FROM bom_tree
    ORDER BY level, sequence;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_bom_tree IS 'Returns hierarchical BOM tree for a product with indented display';

-- Function: Calculate Total BOM Cost
CREATE OR REPLACE FUNCTION calculate_bom_cost(p_product_id UUID, p_version VARCHAR DEFAULT '1.0')
RETURNS DECIMAL AS $$
DECLARE
    v_total_cost DECIMAL;
BEGIN
    SELECT SUM(extended_cost) INTO v_total_cost
    FROM get_bom_tree(p_product_id, p_version)
    WHERE NOT is_assembly; -- Only count leaf components, not assemblies
    
    RETURN COALESCE(v_total_cost, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_bom_cost IS 'Calculates total cost of all components in a BOM';

-- Function: Explode BOM (Flattened Component List)
CREATE OR REPLACE FUNCTION explode_bom(p_product_id UUID, p_quantity DECIMAL DEFAULT 1, p_version VARCHAR DEFAULT '1.0')
RETURNS TABLE (
    component_sku VARCHAR,
    component_name VARCHAR,
    total_quantity DECIMAL,
    unit_cost DECIMAL,
    total_cost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sku::VARCHAR,
        name::VARCHAR,
        SUM(quantity * p_quantity) AS total_quantity,
        unit_cost,
        SUM(quantity * p_quantity * unit_cost) AS total_cost
    FROM get_bom_tree(p_product_id, p_version)
    WHERE NOT is_assembly
    GROUP BY sku, name, unit_cost
    ORDER BY sku;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION explode_bom IS 'Returns flattened shopping list of all components needed';

-- ============================================================================
-- 7. Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bom_headers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bom_headers_updated_at
    BEFORE UPDATE ON bom_headers
    FOR EACH ROW
    EXECUTE FUNCTION update_bom_headers_timestamp();
