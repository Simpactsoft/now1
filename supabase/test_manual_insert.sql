-- Test if the user can insert to option_groups manually
-- This will tell us if it's a code problem or RLS problem

-- First, check what tenant_id the current user has
SELECT id, tenant_id, email 
FROM profiles 
WHERE id = auth.uid();

-- Second, try a manual insert
INSERT INTO option_groups (
    tenant_id,
    template_id,
    name,
    selection_type,
    is_required,
    min_selections,
    source_type,
    display_order
)
VALUES (
    (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
    '7934586f-1896-4257-9830-9d0ea04e0c40',
    'Test Manual Insert',
    'single',
    false,
    0,
    'manual',
    999
);

-- If this works, the problem is in the code, not RLS
-- If this fails, the RLS policies are wrong
