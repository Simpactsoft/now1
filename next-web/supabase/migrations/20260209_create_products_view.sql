
-- Create Stock View for Performance
CREATE OR REPLACE VIEW product_stock_view AS
SELECT 
  product_id,
  SUM(quantity_change) as stock_quantity
FROM inventory_ledger
GROUP BY product_id;

-- Add Status Column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'status') THEN 
        ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'ACTIVE'; 
    END IF; 
END $$;
