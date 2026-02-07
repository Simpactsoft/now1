# V3 Sales & Inventory Module - Developer Quickstart

## 1. Setting the Stage (Tenant Context)

**CRITICAL**: The V3 module uses "Dual-Lock" RLS. You **MUST** set the tenant context before every request or transaction.

```sql
-- In SQL Editor or psql
SET app.current_tenant = 'your-tenant-uuid';

-- In Node.js (pg client)
await client.query('SET LOCAL app.current_tenant = $1', [tenantId]);
```

If you forget this, queries will return **0 rows** (RLS blocks everything).

## 2. Core Entities

### Products & Categories
Products are linked to the `product_categories` tree.
- **Hierarchy**: Categories use `ltree`. To find all laptops (including subcategories):
  ```sql
  SELECT * FROM products 
  JOIN product_categories pc ON products.category_id = pc.id
  WHERE pc.path <@ 'root.electronics.laptops'::ltree;
  ```

### Inventory
Inventory is **Double-Entry**. You never update a "quantity" column.
- **Check Stock**:
  ```sql
  SELECT get_current_inventory(product_id);        -- On Hand
  SELECT get_available_to_promise(product_id);     -- Available (On Hand - Reserved)
  ```
- **Change Stock**:
  ```sql
  SELECT record_inventory_transaction(
      product_id, 
      10,                -- Quantity Change (+/-)
      'purchase',        -- Type
      order_id,          -- Reference
      'New Stock'        -- Note
  );
  ```

### Orders
Orders manage the sales lifecycle. 
- Link to `cards` table for `customer_id`.
- Use `inventory_reservations` to hold stock during checkout.

## 3. Common Workflows

### Creating an Order
1.  **Draft**: Insert into `orders` with status 'draft'.
2.  **Add Items**: Insert into `order_items`.
3.  **Confirm**: Update status to 'confirmed'.
4.  **Reserve**: Call `reserve_inventory()` for each item.
5.  **Fulfill**: Delete reservation, add ledger entry ('sale').

### Troubleshooting

| Error | Cause | Fix |
| :--- | :--- | :--- |
| `new row violates row-level security policy` | Missing `app.current_tenant` | Set the session variable used in the RLS policy. |
| `Insufficient inventory` | ATP check failed | Check `get_available_to_promise()` before reserving. |
| `violates foreign key constraint` | Invalid link | Ensure `tenant_id` matches parent record. |
