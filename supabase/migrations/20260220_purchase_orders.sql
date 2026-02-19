-- ============================================================================
-- Purchase Orders
-- Migration: 20260220_purchase_orders
-- Date: 2026-02-20
-- Description: Vendors, purchase orders, PO items tables. Renames
--              invoice_number_sequences → document_number_sequences.
--              RPCs for PO lifecycle: submit, approve, receive, cancel.
--              Receive creates inventory entries + journal entry.
-- Dependencies: 007_add_sales_inventory_tables, 20260219_invoice_generation,
--               20260219_multi_warehouse, 20260223_accounting_mvp,
--               20260215_tax_engine, 20260221_product_variants
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RENAME invoice_number_sequences → document_number_sequences
-- ============================================================================

ALTER TABLE IF EXISTS invoice_number_sequences RENAME TO document_number_sequences;

-- Add document_type column (default 'invoice' for backward compat)
ALTER TABLE document_number_sequences
    ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'invoice';

-- Drop old unique, add new one with document_type
ALTER TABLE document_number_sequences
    DROP CONSTRAINT IF EXISTS invoice_number_sequences_tenant_id_prefix_year_key;

ALTER TABLE document_number_sequences
    ADD CONSTRAINT document_number_sequences_tenant_type_prefix_year_key
    UNIQUE (tenant_id, document_type, prefix, year);

-- ============================================================================
-- 2. REPLACE generate_invoice_number with generate_document_number
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_document_number(
    p_tenant_id UUID,
    p_document_type TEXT DEFAULT 'invoice',
    p_prefix TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_next INT;
    v_prefix TEXT;
BEGIN
    -- Default prefix based on document type
    IF p_prefix IS NOT NULL THEN
        v_prefix := p_prefix;
    ELSIF p_document_type = 'invoice' THEN
        v_prefix := 'INV';
    ELSIF p_document_type = 'po' THEN
        v_prefix := 'PO';
    ELSIF p_document_type = 'payment' THEN
        v_prefix := 'PAY';
    ELSE
        v_prefix := UPPER(LEFT(p_document_type, 3));
    END IF;

    INSERT INTO document_number_sequences (tenant_id, document_type, prefix, year, last_number)
    VALUES (p_tenant_id, p_document_type, v_prefix, v_year, 1)
    ON CONFLICT (tenant_id, document_type, prefix, year)
    DO UPDATE SET last_number = document_number_sequences.last_number + 1
    RETURNING last_number INTO v_next;

    RETURN v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION generate_document_number IS 'Generates next sequential document number per tenant/type/year';

-- Keep backward-compat wrapper
CREATE OR REPLACE FUNCTION generate_invoice_number(
    p_tenant_id UUID,
    p_prefix TEXT DEFAULT 'INV'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN generate_document_number(p_tenant_id, 'invoice', p_prefix);
END;
$$;

-- ============================================================================
-- 3. VENDORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    country TEXT DEFAULT 'IL',
    tax_id TEXT,
    payment_terms_days INTEGER DEFAULT 30,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vendors IS 'Supplier/vendor master data for purchase orders';

-- Unique tax_id per tenant (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_tenant_taxid
    ON vendors(tenant_id, tax_id) WHERE tax_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_active ON vendors(tenant_id, is_active);

-- RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_select ON vendors FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY vendors_all ON vendors FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 4. PURCHASE ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    po_number TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'partial', 'cancelled')),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    warehouse_id UUID REFERENCES warehouses(id),
    tax_zone_id UUID REFERENCES tax_zones(id),
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ILS',
    notes TEXT,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, po_number)
);

COMMENT ON TABLE purchase_orders IS 'Purchase orders sent to vendors for procurement';

CREATE INDEX IF NOT EXISTS idx_po_tenant_status ON purchase_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse ON purchase_orders(tenant_id, warehouse_id);

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_select ON purchase_orders FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY po_all ON purchase_orders FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 5. PURCHASE ORDER ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    description TEXT NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    received_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit_price NUMERIC(15, 4) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- RLS
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_items_select ON purchase_order_items FOR SELECT TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);
CREATE POLICY po_items_all ON purchase_order_items FOR ALL TO authenticated
    USING (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL)
    WITH CHECK (tenant_id = get_current_tenant_id() AND get_current_tenant_id() IS NOT NULL);

-- ============================================================================
-- 6. RPCs
-- ============================================================================

-- 6a. submit_purchase_order
CREATE OR REPLACE FUNCTION submit_purchase_order(p_po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
    v_item_count INT;
    v_invalid_count INT;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status != 'draft' THEN
        RAISE EXCEPTION 'PO % is not in draft status (current: %)', p_po_id, v_po.status;
    END IF;

    -- Validate has items
    SELECT COUNT(*) INTO v_item_count FROM purchase_order_items WHERE po_id = p_po_id;
    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'PO % has no items', p_po_id;
    END IF;

    -- Validate all items have qty > 0
    SELECT COUNT(*) INTO v_invalid_count
    FROM purchase_order_items WHERE po_id = p_po_id AND quantity <= 0;
    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'PO % has % items with invalid quantity', p_po_id, v_invalid_count;
    END IF;

    UPDATE purchase_orders
    SET status = 'submitted', updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION submit_purchase_order IS 'Validates and submits a draft PO';

-- 6b. approve_purchase_order
CREATE OR REPLACE FUNCTION approve_purchase_order(
    p_po_id UUID,
    p_approved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status != 'submitted' THEN
        RAISE EXCEPTION 'PO % is not in submitted status (current: %)', p_po_id, v_po.status;
    END IF;

    UPDATE purchase_orders
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION approve_purchase_order IS 'Approves a submitted PO';

-- 6c. receive_purchase_order
-- p_items = array of {"item_id": uuid, "received_qty": numeric}
CREATE OR REPLACE FUNCTION receive_purchase_order(
    p_po_id UUID,
    p_items JSONB,
    p_received_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po purchase_orders%ROWTYPE;
    v_item RECORD;
    v_recv RECORD;
    v_all_received BOOLEAN := TRUE;
    v_any_received BOOLEAN := FALSE;
    v_je_id UUID;
    v_total_cost NUMERIC := 0;
    v_inventory_account UUID;
    v_ap_account UUID;
    v_warehouse_id UUID;
BEGIN
    -- Get PO
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_po.status NOT IN ('approved', 'partial') THEN
        RAISE EXCEPTION 'PO % cannot receive goods (status: %)', p_po_id, v_po.status;
    END IF;

    -- Determine warehouse
    v_warehouse_id := v_po.warehouse_id;
    IF v_warehouse_id IS NULL THEN
        -- Use default warehouse for tenant
        SELECT id INTO v_warehouse_id FROM warehouses
        WHERE tenant_id = v_po.tenant_id AND is_default = true LIMIT 1;
        IF v_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'No warehouse specified on PO and no default warehouse found for tenant %', v_po.tenant_id;
        END IF;
    END IF;

    -- Lookup GL accounts by account_number
    SELECT id INTO v_inventory_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_number = '1400' LIMIT 1;
    SELECT id INTO v_ap_account FROM chart_of_accounts
        WHERE tenant_id = v_po.tenant_id AND account_number = '2100' LIMIT 1;

    IF v_inventory_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Inventory (1400) not found for tenant %', v_po.tenant_id;
    END IF;
    IF v_ap_account IS NULL THEN
        RAISE EXCEPTION 'Missing GL account: Accounts Payable (2100) not found for tenant %', v_po.tenant_id;
    END IF;

    -- Process each received item
    FOR v_recv IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, received_qty NUMERIC)
    LOOP
        -- Get the PO item
        SELECT * INTO v_item FROM purchase_order_items
        WHERE id = v_recv.item_id AND po_id = p_po_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PO item % not found on PO %', v_recv.item_id, p_po_id;
        END IF;

        IF v_recv.received_qty <= 0 THEN
            CONTINUE; -- skip zero/negative
        END IF;

        -- Check not over-receiving
        IF (v_item.received_quantity + v_recv.received_qty) > v_item.quantity THEN
            RAISE EXCEPTION 'Over-receiving item %: ordered %, already received %, trying to receive %',
                v_recv.item_id, v_item.quantity, v_item.received_quantity, v_recv.received_qty;
        END IF;

        -- Update received quantity
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + v_recv.received_qty,
            updated_at = NOW()
        WHERE id = v_recv.item_id;

        -- Create inventory ledger entry
        IF v_item.product_id IS NOT NULL THEN
            INSERT INTO inventory_ledger (
                tenant_id, product_id, warehouse_id,
                transaction_type, quantity_change, reference_id, notes
            ) VALUES (
                v_po.tenant_id, v_item.product_id, v_warehouse_id,
                'po_receipt', v_recv.received_qty, p_po_id,
                'PO ' || v_po.po_number || ' receipt'
            );
        END IF;

        v_total_cost := v_total_cost + ROUND(v_recv.received_qty * v_item.unit_price, 2);
        v_any_received := TRUE;
    END LOOP;

    IF NOT v_any_received THEN
        RAISE EXCEPTION 'No items were received';
    END IF;

    -- Check if all items fully received
    SELECT bool_and(received_quantity >= quantity) INTO v_all_received
    FROM purchase_order_items WHERE po_id = p_po_id;

    -- Create journal entry: DR Inventory, CR Accounts Payable
    INSERT INTO journal_entries (tenant_id, entry_date, memo, status, reference_type, reference_id, created_by)
    VALUES (
        v_po.tenant_id, CURRENT_DATE,
        'PO ' || v_po.po_number || ' goods received',
        'draft', 'purchase_order', p_po_id, p_received_by
    )
    RETURNING id INTO v_je_id;

    -- DR: Inventory asset
    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_inventory_account, v_total_cost, 0,
            'Inventory from PO ' || v_po.po_number);

    -- CR: Accounts Payable
    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, description)
    VALUES (v_po.tenant_id, v_je_id, v_ap_account, 0, v_total_cost,
            'AP for PO ' || v_po.po_number);

    -- Post journal entry
    UPDATE journal_entries SET status = 'posted', posted_date = NOW() WHERE id = v_je_id;

    -- Update PO status
    UPDATE purchase_orders
    SET status = CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN v_je_id;
END;
$$;

COMMENT ON FUNCTION receive_purchase_order IS 'Receives goods on a PO: updates inventory, creates journal entry (DR Inventory, CR AP)';

-- 6d. cancel_purchase_order
CREATE OR REPLACE FUNCTION cancel_purchase_order(p_po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM purchase_orders WHERE id = p_po_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order % not found', p_po_id;
    END IF;

    IF v_status NOT IN ('draft', 'submitted') THEN
        RAISE EXCEPTION 'Cannot cancel PO in status: %', v_status;
    END IF;

    UPDATE purchase_orders
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION cancel_purchase_order IS 'Cancels a draft or submitted PO';

-- ============================================================================
-- 7. TRIGGERS: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_vendors_updated_at();

CREATE OR REPLACE FUNCTION update_po_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_po_updated_at ON purchase_orders;
CREATE TRIGGER trg_po_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_po_updated_at();

CREATE OR REPLACE FUNCTION update_po_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_po_items_updated_at ON purchase_order_items;
CREATE TRIGGER trg_po_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_po_items_updated_at();

COMMIT;
