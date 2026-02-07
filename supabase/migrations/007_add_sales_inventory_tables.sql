BEGIN;

-- 0. Ensure Dependency Exists (Idempotent)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
    SELECT current_setting('app.current_tenant', true)::UUID;
$$;

-- 1. Product Categories (Hybrid Tree)
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- No FK to tenants table to avoid circular dependency issues during restore, but logically linked.
    parent_id UUID REFERENCES product_categories(id),
    path ltree NOT NULL DEFAULT 'root'::ltree,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_categories_path ON product_categories USING GIST (path);
CREATE INDEX idx_product_categories_tenant ON product_categories(tenant_id);

-- Recursive Trigger for Categories (Same pattern as profiles)
CREATE OR REPLACE FUNCTION maintain_category_path() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_parent_path ltree;
    old_full_path ltree;
BEGIN
    IF TG_OP = 'INSERT' OR (NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
        IF NEW.parent_id IS NULL THEN
            new_parent_path = 'root'::ltree;
        ELSE
            SELECT path INTO new_parent_path FROM product_categories WHERE id = NEW.parent_id;
            IF NOT FOUND THEN RAISE EXCEPTION 'Parent category % not found', NEW.parent_id; END IF;
        END IF;
        
        NEW.path = new_parent_path || text2ltree(replace(NEW.id::text, '-', '_'));
        
        IF TG_OP = 'UPDATE' AND OLD.path IS DISTINCT FROM NEW.path THEN
            old_full_path := OLD.path;
            UPDATE product_categories
            SET path = NEW.path || subpath(path, nlevel(old_full_path))
            WHERE path <@ old_full_path AND id != NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintain_category_path
    BEFORE INSERT OR UPDATE OF parent_id ON product_categories
    FOR EACH ROW EXECUTE FUNCTION maintain_category_path();

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    supplier_id UUID,
    FOREIGN KEY (tenant_id, supplier_id) REFERENCES cards(tenant_id, id) ON DELETE RESTRICT,
    category_id UUID REFERENCES product_categories(id),
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost_price NUMERIC(15, 2) DEFAULT 0,
    list_price NUMERIC(15, 2) DEFAULT 0,
    track_inventory BOOLEAN DEFAULT true,
    min_stock_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, sku)
);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);

-- 3. Inventory Ledger (Double Entry)
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID, -- Optional for now
    transaction_type TEXT NOT NULL, -- 'purchase', 'sale', 'adjustment', 'return'
    quantity_change NUMERIC(15, 4) NOT NULL, -- Can be negative
    reference_id UUID, -- Order ID or PO ID
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
    -- Immutable by design (no update trigger needed usually, but RLS will enforce INSERT only)
);
CREATE INDEX idx_inventory_ledger_product ON inventory_ledger(product_id);
CREATE INDEX idx_inventory_ledger_tenant ON inventory_ledger(tenant_id);

-- 4. Inventory Reservations (Concurrency Control)
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID, -- Can be null if generic hold
    quantity NUMERIC(15, 4) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reservations_product ON inventory_reservations(product_id);

-- 5. Orders (Sales)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID,
    FOREIGN KEY (tenant_id, customer_id) REFERENCES cards(tenant_id, id) ON DELETE RESTRICT,
    order_number SERIAL, -- Per tenant logic is harder with SERIAL, utilizing standard sequence for now unique globally or composite
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'confirmed', 'shipped', 'cancelled'
    total_amount NUMERIC(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- 6. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- 7. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID REFERENCES orders(id),
    customer_id UUID,
    FOREIGN KEY (tenant_id, customer_id) REFERENCES cards(tenant_id, id),
    status TEXT NOT NULL DEFAULT 'issued',
    due_date DATE,
    total_amount NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ROW LEVEL SECURITY (Dual-Lock Standard)
-- ==========================================

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Helper macro for standard policy
-- We can't use macros in standard SQL, so we define one-by-one or use a DO block. 
-- For clarity in migration, detailed definition.

-- Products
CREATE POLICY products_select ON products FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY products_insert ON products FOR INSERT TO authenticated WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY products_update ON products FOR UPDATE TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY products_delete ON products FOR DELETE TO authenticated USING (tenant_id = get_current_tenant_id());

-- Categories
CREATE POLICY cats_select ON product_categories FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY cats_all ON product_categories FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

-- Inventory Ledger (Append Only for standard users usually, but for now Full RLS)
CREATE POLICY ledger_select ON inventory_ledger FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY ledger_insert ON inventory_ledger FOR INSERT TO authenticated WITH CHECK (tenant_id = get_current_tenant_id());
-- No Update/Delete on Ledger ideally, but strictly enforced by RLS:
CREATE POLICY ledger_update ON inventory_ledger FOR UPDATE TO authenticated USING (false); -- Deny updates
CREATE POLICY ledger_delete ON inventory_ledger FOR DELETE TO authenticated USING (false); -- Deny deletes

-- Reservations
CREATE POLICY reserv_select ON inventory_reservations FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY reserv_all ON inventory_reservations FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

-- Orders
CREATE POLICY orders_select ON orders FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY orders_all ON orders FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

-- Order Items
CREATE POLICY order_items_select ON order_items FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY order_items_all ON order_items FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

-- Invoices
CREATE POLICY invoices_select ON invoices FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());
CREATE POLICY invoices_all ON invoices FOR ALL TO authenticated USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

COMMIT;
