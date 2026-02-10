
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
