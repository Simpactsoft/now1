const { createActivity } = require('./src/app/actions/activity-actions');

async function testCreateActivity() {
    console.log("Testing createActivity...");

    try {
        const result = await createActivity({
            tenantId: '00000000-0000-0000-0000-000000000003',
            entityId: '1295b662-fa20-40fd-abbb-3cd913f66af1',
            entityType: 'card',
            activityType: 'meeting',
            title: 'Test Meeting from Code',
            description: 'This is a test description',
            isTask: false,
            priority: 'high'
        });

        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Test threw error:", e);
    }
}

testCreateActivity();
