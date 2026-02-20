-- Migration: Fix Quotes Relationships
-- Description: Adds missing foreign key constraints to the quotes table 
-- so PostgREST can properly detect relationships for querying.

BEGIN;

ALTER TABLE quotes
    ADD CONSTRAINT fk_quotes_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE quotes
    ADD CONSTRAINT fk_quotes_customer 
    FOREIGN KEY (tenant_id, customer_id) REFERENCES cards(tenant_id, id) ON DELETE SET NULL;



COMMIT;
