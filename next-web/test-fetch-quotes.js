const { fetchQuotesByCustomer } = require('./src/app/actions/fetchQuotesByCustomer');

async function testFetchQuotes() {
    const tenantId = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000003';
    const customerId = process.env.CUSTOMER_ID || '1295b662-fa20-40fd-abbb-3cd913f66af1';

    console.log(`Testing fetchQuotesByCustomer for tenant: ${tenantId}, customer: ${customerId}`);

    try {
        const result = await fetchQuotesByCustomer(tenantId, customerId);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Fetch threw error:", e);
    }
}

testFetchQuotes();
