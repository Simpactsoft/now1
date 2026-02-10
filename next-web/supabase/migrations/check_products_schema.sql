-- Check the structure of the products table/view
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- Also check cards table since products might be a view
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cards'
ORDER BY ordinal_position;
