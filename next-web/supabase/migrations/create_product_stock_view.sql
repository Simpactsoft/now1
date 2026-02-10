
CREATE OR REPLACE VIEW product_stock_view AS
SELECT 
  product_id,
  SUM(quantity_change) as stock_quantity
FROM inventory_ledger
GROUP BY product_id;
