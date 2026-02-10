-- ============================================================================
-- BOM Test Data: Desktop PC Example
-- Purpose: Demonstrate 3-level BOM with assemblies and components
-- Total Cost: 5,200₪ | Sell Price: 5,980₪ | Margin: 15%
-- ============================================================================

-- IMPORTANT: Replace '00000000-0000-0000-0000-000000000003' with your actual tenant UUID before running!

-- ============================================================================
-- 1. Insert Products
-- ============================================================================

-- Level 0: Final Product
INSERT INTO products (id, tenant_id, sku, name, cost_price, list_price, track_inventory, status) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'PC-DESK-001', 'Desktop PC Complete', 5200, 5980, true, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Level 1: Sub-Assemblies
INSERT INTO products (id, tenant_id, sku, name, cost_price, list_price, track_inventory, status) VALUES
('22222222-2222-2222-2222-222222222221', '00000000-0000-0000-0000-000000000003', 'MOBO-ASSY-001', 'Motherboard Assembly', 2100, 2310, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000003', 'MEM-KIT-32GB', 'Memory Kit 32GB DDR5', 450, 504, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222223', '00000000-0000-0000-0000-000000000003', 'STOR-ASSY-001', 'Storage Assembly', 650, 702, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222224', '00000000-0000-0000-0000-000000000003', 'GPU-RTX4070', 'Graphics Card RTX 4070', 1800, 1980, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222225', '00000000-0000-0000-0000-000000000003', 'PSU-750W-80P', 'Power Supply 750W 80+ Gold', 350, 403, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222226', '00000000-0000-0000-0000-000000000003', 'CASE-ATX-MID', 'Case ATX Mid-Tower', 250, 300, true, 'ACTIVE'),
('22222222-2222-2222-2222-222222222227', '00000000-0000-0000-0000-000000000003', 'ACC-KIT-001', 'Accessories Kit', 100, 105, true, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Level 2: Components
INSERT INTO products (id, tenant_id, sku, name, cost_price, list_price, track_inventory, status) VALUES
('33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000003', 'MOBO-Z690', 'Motherboard Z690 DDR5', 850, 850, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000003', 'CPU-I7-13700K', 'Intel Core i7-13700K', 1200, 1200, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000003', 'COOL-AIO240', 'AIO Liquid Cooler 240mm', 150, 150, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333334', '00000000-0000-0000-0000-000000000003', 'RAM-16GB-DDR5', 'RAM 16GB DDR5 5600MHz', 225, 225, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333335', '00000000-0000-0000-0000-000000000003', 'SSD-NVME-1TB', 'SSD NVMe Gen4 1TB', 450, 450, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333336', '00000000-0000-0000-0000-000000000003', 'HDD-2TB-SATA', 'HDD 2TB 7200RPM SATA', 200, 200, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333337', '00000000-0000-0000-0000-000000000003', 'CABLE-KIT-001', 'Cable Kit SATA/Power', 50, 50, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333338', '00000000-0000-0000-0000-000000000003', 'SCREW-KIT-PC', 'PC Screws Assortment', 20, 20, true, 'ACTIVE'),
('33333333-3333-3333-3333-333333333339', '00000000-0000-0000-0000-000000000003', 'PASTE-THRM-4G', 'Thermal Paste 4g', 30, 30, true, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create BOM Header
-- ============================================================================
INSERT INTO bom_headers (id, tenant_id, product_id, version, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '1.0', 'ACTIVE')
ON CONFLICT (product_id, version) DO NOTHING;

-- ============================================================================
-- 3. BOM Items - Level 0 (Root)
-- ============================================================================
INSERT INTO bom_items (id, tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('b0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, '11111111-1111-1111-1111-111111111111', 0, 0, 1, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. BOM Items - Level 1 (Sub-Assemblies)
-- ============================================================================
INSERT INTO bom_items (id, tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('b1000001-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222221', 1, 1, 1, true),  -- Motherboard Assy
('b1000002-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 1, 2, 1, true),  -- Memory Kit
('b1000003-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222223', 1, 3, 1, true),  -- Storage Assy
('b1000004-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222224', 1, 4, 1, false), -- GPU
('b1000005-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222225', 1, 5, 1, false), -- PSU
('b1000006-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222226', 1, 6, 1, false), -- Case
('b1000007-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222227', 1, 7, 1, true)   -- Accessories
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. BOM Items - Level 2 (Components)
-- ============================================================================

-- Motherboard Assembly Components
INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000001-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333331', 2, 1, 1, false), -- Motherboard
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000001-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333332', 2, 2, 1, false), -- CPU
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000001-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 2, 3, 1, false)  -- Cooler
ON CONFLICT DO NOTHING;

-- Memory Kit Components
INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000002-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333334', 2, 1, 2, false)  -- RAM x2
ON CONFLICT DO NOTHING;

-- Storage Assembly Components
INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000003-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333335', 2, 1, 1, false), -- SSD
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000003-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333336', 2, 2, 1, false)  -- HDD
ON CONFLICT DO NOTHING;

-- Accessories Kit Components
INSERT INTO bom_items (tenant_id, bom_header_id, parent_item_id, component_product_id, level, sequence, quantity, is_assembly) VALUES
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000007-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333337', 2, 1, 1, false), -- Cables
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000007-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333338', 2, 2, 1, false), -- Screws
('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1000007-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333339', 2, 3, 1, false)  -- Paste
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Verification Queries
-- ============================================================================

-- View BOM Tree
SELECT * FROM get_bom_tree('11111111-1111-1111-1111-111111111111', '1.0');

-- Calculate Total Cost
SELECT calculate_bom_cost('11111111-1111-1111-1111-111111111111', '1.0') AS total_cost;

-- Explode BOM (Shopping List for 1 unit)
SELECT * FROM explode_bom('11111111-1111-1111-1111-111111111111', 1, '1.0');

-- Explode BOM (Shopping List for 10 units)
SELECT * FROM explode_bom('11111111-1111-1111-1111-111111111111', 10, '1.0');

-- View Costing
SELECT 
    level,
    sku,
    name,
    total_quantity,
    extended_cost,
    is_assembly
FROM bom_costing_view
WHERE bom_header_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY level, path;
