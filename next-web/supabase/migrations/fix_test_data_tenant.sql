-- Fix test data tenant_id automatically
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get current tenant_id
    v_tenant_id := get_current_tenant_id();
    
    RAISE NOTICE 'Using tenant_id: %', v_tenant_id;
    
    -- Update products
    UPDATE products 
    SET tenant_id = v_tenant_id
    WHERE id IN (
        -- Level 0
        '11111111-1111-1111-1111-111111111111',
        -- Level 1
        '22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222223',
        '22222222-2222-2222-2222-222222222224',
        '22222222-2222-2222-2222-222222222225',
        '22222222-2222-2222-2222-222222222226',
        '22222222-2222-2222-2222-222222222227',
        -- Level 2
        '33333333-3333-3333-3333-333333333331',
        '33333333-3333-3333-3333-333333333332',
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333334',
        '33333333-3333-3333-3333-333333333335',
        '33333333-3333-3333-3333-333333333336',
        '33333333-3333-3333-3333-333333333337',
        '33333333-3333-3333-3333-333333333338',
        '33333333-3333-3333-3333-333333333339'
    );
    
    RAISE NOTICE 'Updated % products', SQL%ROWCOUNT;
    
    -- Update bom_headers
    UPDATE bom_headers 
    SET tenant_id = v_tenant_id
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    RAISE NOTICE 'Updated % bom_headers', SQL%ROWCOUNT;
    
    -- Update bom_items
    UPDATE bom_items 
    SET tenant_id = v_tenant_id
    WHERE bom_header_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    RAISE NOTICE 'Updated % bom_items', SQL%ROWCOUNT;
    
    RAISE NOTICE 'Update complete!';
END $$;

-- Verify the update
SELECT 
    'BOM items now visible!' as status,
    COUNT(*) as total_items
FROM bom_items
WHERE bom_header_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

