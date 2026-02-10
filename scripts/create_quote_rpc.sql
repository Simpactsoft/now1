-- ====================================================
-- RPC: Get Quote Master Data
-- Bundles Categories, Products (w/ Stock), and Customers
-- Sets Tenant Context internally to satisfy RLS
-- ====================================================

CREATE OR REPLACE FUNCTION get_quote_master_data(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_categories JSONB;
    v_products JSONB;
    v_customers JSONB;
BEGIN
    -- 1. Set Context for RLS
    -- checks inside get_current_inventory and table policies will use this
    PERFORM set_config('app.current_tenant', p_tenant_id::TEXT, true);

    -- 2. Fetch Categories
    SELECT jsonb_agg(to_jsonb(c)) INTO v_categories
    FROM (
        SELECT id, parent_id, name, path::text
        FROM product_categories
        WHERE tenant_id = p_tenant_id
        ORDER BY path
    ) c;

    -- 3. Fetch Products with Real-time Inventory
    SELECT jsonb_agg(to_jsonb(p)) INTO v_products
    FROM (
        SELECT 
            prod.id, 
            prod.sku, 
            prod.name, 
            prod.cost_price, 
            prod.list_price, 
            prod.track_inventory, 
            prod.category_id,
            -- Calculate stock if tracked, else null or 0
            CASE 
                WHEN prod.track_inventory THEN COALESCE(public.get_available_to_promise(prod.id), 0)
                ELSE NULL
            END as current_stock
        FROM products prod
        WHERE prod.tenant_id = p_tenant_id
        ORDER BY prod.name
    ) p;

    -- 4. Fetch Customers (Cards)
    SELECT jsonb_agg(to_jsonb(u)) INTO v_customers
    FROM (
        SELECT id, display_name as name
        FROM cards
        WHERE tenant_id = p_tenant_id 
        AND type = 'person'
        ORDER BY display_name
    ) u;

    -- Return Combined Object
    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'products', COALESCE(v_products, '[]'::jsonb),
        'customers', COALESCE(v_customers, '[]'::jsonb)
    );
END;
$$;
