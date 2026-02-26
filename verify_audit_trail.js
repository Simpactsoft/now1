require('dotenv').config({ path: 'next-web/.env.local' });
const { Client } = require('pg');

async function testAuditTrail() {
    console.log("Starting Audit Trail Test...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Set Mock Headers (Mimicking PostgREST behavior)
        const mockUserId = '11111111-1111-1111-1111-111111111111';
        const mockTenantId = '22222222-2222-2222-2222-222222222222';

        console.log(`Setting mock session headers for User: ${mockUserId}`);
        const headersJson = JSON.stringify({
            'x-audit-user-id': mockUserId,
            'x-audit-tenant-id': mockTenantId
        });

        await client.query(`SET request.headers = '${headersJson}'`);

        // 2. Perform a tracked operation (e.g., Update an organization)
        // Finding an organization to update safely
        const { rows: orgs } = await client.query('SELECT id, name FROM organizations LIMIT 1');

        if (orgs.length === 0) {
            console.log("No organizations found to test with. Exiting.");
            return;
        }

        const testOrg = orgs[0];
        const newName = testOrg.name + " (Audited)";

        console.log(`Updating organization ${testOrg.id} to trigger audit...`);
        await client.query('UPDATE organizations SET name = $1 WHERE id = $2', [newName, testOrg.id]);

        // 3. Verify the Audit Log was created
        console.log("Fetching new audit logs...");
        const { rows: logs } = await client.query(`
            SELECT * FROM enterprise_audit_logs 
            WHERE table_name = 'organizations' 
            AND record_id = $1 
            ORDER BY created_at DESC LIMIT 1
        `, [testOrg.id]);

        if (logs.length > 0) {
            const log = logs[0];
            console.log("✅ AUDIT SUCCESS!");
            console.log("- Operation:", log.operation);
            console.log("- Performed By (Header captured):", log.performed_by);
            console.log("- Changed Fields:", log.changed_fields);
            console.log("- Old Data Name:", log.old_data.name);
            console.log("- New Data Name:", log.new_data.name);

            if (log.performed_by === mockUserId) {
                console.log("✅ Header injection verification PASSED.");
            } else {
                console.log("❌ Header injection FAILED. Performed By mismatch.");
            }
        } else {
            console.log("❌ AUDIT FAILED. No log was generated.");
        }

        // Revert the change
        await client.query('UPDATE organizations SET name = $1 WHERE id = $2', [testOrg.name, testOrg.id]);
        console.log("Reverted organization name to original.");

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await client.end();
    }
}

testAuditTrail();
