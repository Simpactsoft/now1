# API Integration Guide: Sales & Inventory (V3)

## Security Guidelines
1.  **Session Context**: Middleware **MUST** set `app.current_tenant` immediately after authentication.
2.  **Input Validation**: Validate all UUIDs and Enums (e.g., transaction types) before SQL execution.
3.  **Transactions**: Use `BEGIN...COMMIT` blocks for multi-step workflows (Order Creation, Fulfillment).

## Node.js / TypeScript Examples

### 1. Middleware (Tenant Context)
```typescript
async function withTransaction(tenantId: string, callback: (client: Client) => Promise<any>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SECURE THE SESSION
    await client.query('SET LOCAL app.current_tenant = $1', [tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

### 2. Creating a Product
```typescript
const createProduct = async (tenantId: string, data: ProductDTO) => {
  return withTransaction(tenantId, async (client) => {
    const res = await client.query(`
      INSERT INTO products (
        tenant_id, sku, name, cost_price, list_price
      )
      VALUES (
        get_current_tenant_id(), -- Double check (optional but safe) or params
        $1, $2, $3, $4
      )
      RETURNING id
    `, [data.sku, data.name, data.cost, data.price]);
    return res.rows[0];
  });
};
```

### 3. Reserving Inventory (Checkout)
```typescript
const reserveItems = async (tenantId: string, orderId: string, items: OrderItem[]) => {
  return withTransaction(tenantId, async (client) => {
    for (const item of items) {
      // Call Database Function for Pessimistic Lock
      await client.query(`
        SELECT reserve_inventory($1, $2, $3)
      `, [item.productId, item.quantity, orderId]);
    }
  });
};
```

## Error Handling
The database will raise specific exceptions. Map these to HTTP codes:

- `P0001` (Raise Exception): Business logic error (e.g., "Insufficient inventory"). -> **409 Conflict**
- `42501` (RLS Violation): Unauthorized access. -> **403 Forbidden**
- `23505` (Uniqueness): Duplicate SKU. -> **400 Bad Request**
