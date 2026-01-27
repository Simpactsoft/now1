-- Migration: 87_data_normalization.sql
-- Description: Normalize existing data in 'parties' table.
-- WARNING: This affects many rows and may be slow. Use smaller batches if needed.

-- Batch 1: Leads
UPDATE parties 
SET status = 'LEAD' 
WHERE type = 'person' AND lower(trim(status)) IN ('lead', 'new lead', 'new', 'פנייה', 'ליד');

-- Batch 2: Customers
UPDATE parties 
SET status = 'CUSTOMER' 
WHERE type = 'person' AND lower(trim(status)) IN ('customer', 'active', 'לקוח');

-- Batch 3: Churned
UPDATE parties 
SET status = 'CHURNED' 
WHERE type = 'person' AND lower(trim(status)) IN ('churned', 'lost', 'inactive', 'נטש');

-- Batch 4: Qualified
UPDATE parties 
SET status = 'QUALIFIED' 
WHERE type = 'person' AND lower(trim(status)) IN ('qualified', 'מוסמך');

-- Batch 5: Partner
UPDATE parties 
SET status = 'PARTNER' 
WHERE type = 'person' AND lower(trim(status)) IN ('partner', 'שותף');

-- Batch 6: Uppercase Remainder
UPDATE parties
SET status = upper(trim(status))
WHERE type = 'person' AND status IS NOT NULL AND status != upper(trim(status));
