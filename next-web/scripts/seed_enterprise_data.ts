import { createClient } from '@supabase/supabase-js';
import { fakerHE, fakerEN } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Configure constants for volume
const NUM_ORGS = 5000;
const NUM_PEOPLE_PER_ORG = 10; // Total 50,000 people

async function clearData() {
    console.log('🧹 Clearing old CRM data (preserving system users)...');

    const fakeUUID = '00000000-0000-0000-0000-000000000000';

    const tables = [
        'inventory_transactions',
        'purchase_order_items',
        'purchase_orders',
        'quote_items',
        'quotes',
        'opportunities',
        'opportunity_cards',
        'activity_participants',
        'activities'
    ];

    for (const table of tables) {
        console.log(`Clearing ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', fakeUUID);
        if (error && !error.message.includes('does not exist')) {
            console.error(`Error clearing ${table}:`, error.message);
        }
    }

    console.log('Detaching products from suppliers...');
    await supabase.from('products').update({ supplier_id: null }).neq('id', fakeUUID);

    console.log('Clearing cards...');
    const { error: errOrgs } = await supabase
        .from('cards')
        .delete()
        .in('type', ['organization', 'person']);

    if (errOrgs) {
        console.error('Error clearing cards:', errOrgs.message);
        throw errOrgs;
    }

    console.log('✅ Old CRM data fully cleared.');
}

async function getTenantId() {
    const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', 'galactic_stress_test')
        .limit(1)
        .single();

    if (error || !data) {
        console.error('Could not find the Galactic Stress Test tenant. Please ensure it exists.');
        throw error || new Error('No Galactic Stress Test tenant found');
    }

    return data.id;
}

async function seedData(tenantId: string) {
    console.log(`🌱 Beginning seed process for tenant ${tenantId}...`);
    console.log(`Generating ${NUM_ORGS} organizations and ${NUM_ORGS * NUM_PEOPLE_PER_ORG} people. This may take a while.`);

    const BATCH_SIZE = 1000;

    async function insertBatch(table: string, records: any[]) {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(table).insert(batch);
            if (error) {
                console.error(`Error inserting batch into ${table}:`, error.message);
                throw error;
            }
        }
    }

    // 1. Generate Organizations
    const organizationsCards = [];
    const organizationsExt = [];

    for (let i = 0; i < NUM_ORGS; i++) {
        const isIsraeli = Math.random() < 0.3;
        const faker = isIsraeli ? fakerHE : fakerEN;

        const cardId = crypto.randomUUID();
        const companyName = faker.company.name();
        const formattedId = cardId.replace(/-/g, '_');

        organizationsCards.push({
            id: cardId,
            tenant_id: tenantId,
            type: 'organization',
            display_name: companyName,
            contact_methods: [
                { type: 'email', value: faker.internet.email(), is_primary: true },
                { type: 'phone', value: faker.phone.number(), is_primary: true }
            ],
            custom_fields: {},
            lifecycle_stage: faker.helpers.arrayElement(['lead', 'customer', 'mql', 'sql', 'opportunity']),
            hierarchy_path: formattedId
        });

        organizationsExt.push({
            card_id: cardId,
            tax_id: isIsraeli ? String(faker.number.int({ min: 500000000, max: 599999999 })) : faker.company.buzzNoun(),
            company_size: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '500+']),
            industry: faker.company.buzzAdjective()
        });
    }

    try {
        console.log(`Inserting ${organizationsCards.length} organizations base cards...`);
        await insertBatch('cards', organizationsCards);

        console.log(`Inserting ${organizationsExt.length} organizations extension details...`);
        await insertBatch('organizations', organizationsExt);
    } catch (err) {
        console.warn("Skipping organizationsExt due to trigger issues. Organizations will only have base cards.");
    }

    // 2. Generate People
    const peopleCards = [];
    const peopleExt = [];

    let orgIndex = 0;
    for (let i = 0; i < NUM_ORGS * NUM_PEOPLE_PER_ORG; i++) {
        const isIsraeli = Math.random() < 0.3;
        const faker = isIsraeli ? fakerHE : fakerEN;

        const cardId = crypto.randomUUID();
        const formattedId = cardId.replace(/-/g, '_');
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const currentOrgId = organizationsCards[orgIndex].id;

        if ((i + 1) % NUM_PEOPLE_PER_ORG === 0) {
            orgIndex++;
        }

        peopleCards.push({
            id: cardId,
            tenant_id: tenantId,
            type: 'person',
            display_name: `${firstName} ${lastName}`,
            contact_methods: [
                { type: 'email', value: faker.internet.email({ firstName, lastName }), is_primary: true },
                { type: 'phone', value: faker.phone.number(), is_primary: true }
            ],
            custom_fields: {},
            lifecycle_stage: faker.helpers.arrayElement(['lead', 'mql', 'sql', 'customer', 'subscriber']),
            hierarchy_path: formattedId
        });

        peopleExt.push({
            card_id: cardId,
            first_name: firstName,
            last_name: lastName,
            gender: faker.person.sex()
        });
    }

    console.log(`Inserting ${peopleCards.length} people base cards...`);
    await insertBatch('cards', peopleCards);

    try {
        console.log(`Inserting ${peopleExt.length} people extension details...`);
        await insertBatch('people', peopleExt);
    } catch (err) {
        console.warn("Skipping peopleExt due to trigger issues. People will only have base cards.");
    }

    console.log('✅ Seeding complete!');
    await supabase.rpc('enable_enterprise_audit', { p_table_name: 'organizations' });
}

async function run() {
    try {
        await clearData();
        const tenantId = await getTenantId();
        await seedData(tenantId);
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

run();
