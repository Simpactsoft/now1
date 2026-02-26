import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    try {
        console.log("🔍 Finding 'Galactic Stress Test' tenant...");
        const { data: tenant, error: tenantErr } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', 'galactic_stress_test')
            .single();

        if (tenantErr || !tenant) {
            throw new Error("Could not find the Galactic Stress Test tenant.");
        }
        const tenantId = tenant.id;

        async function fetchAllRecords(type: string) {
            let allData: any[] = [];
            let from = 0;
            const step = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('cards')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('type', type)
                    .range(from, from + step - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;

                allData = allData.concat(data);
                if (data.length < step) break; // Finished
                from += step;
            }
            return allData;
        }

        console.log("📥 Fetching organizations and people lists (paginated)...");
        const orgs = await fetchAllRecords('organization');
        const people = await fetchAllRecords('person');

        if (!orgs?.length || !people?.length) {
            throw new Error("Missing organizations or people. Please seed them first.");
        }

        console.log(`Found ${orgs.length} organizations and ${people.length} people.`);

        // Seed Relationship Types if missing
        console.log("⚙️ Setting up relationship types...");
        const defaultTypes = [
            { tenant_id: tenantId, name: 'Employee', reverse_name: 'Employer', is_directional: true },
            { tenant_id: tenantId, name: 'Contractor', reverse_name: 'Client', is_directional: true },
            { tenant_id: tenantId, name: 'Board Member', reverse_name: 'Board', is_directional: true },
            { tenant_id: tenantId, name: 'Advisor', reverse_name: 'Advisee', is_directional: true }
        ];

        for (const type of defaultTypes) {
            await supabase.from('relationship_types').upsert(type, { onConflict: 'tenant_id, name' });
        }

        const { data: relTypes } = await supabase
            .from('relationship_types')
            .select('id, name')
            .eq('tenant_id', tenantId);

        if (!relTypes || relTypes.length === 0) throw new Error("Failed to load relationship types.");

        console.log("🗑️ Clearing old relationships...");
        await supabase.from('entity_relationships').delete().eq('tenant_id', tenantId);

        console.log("🔗 Generating connections...");
        // Distribution rules:
        // 10% of orgs -> ~100 connections
        // 80% of orgs -> 3 to 10 connections
        // 10% of orgs -> 1 connection

        const totalOrgs = orgs.length;
        const groupAOrgs = Math.floor(totalOrgs * 0.10); // 10% with 100
        const groupCOrgs = Math.floor(totalOrgs * 0.10); // 10% with 1
        const groupBOrgs = totalOrgs - groupAOrgs - groupCOrgs; // 80% with 3-10

        // Shuffle orgs so assignment is random
        const shuffledOrgs = [...orgs].sort(() => 0.5 - Math.random());

        const getRandInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

        let relationships = [];
        let personIndex = 0;

        const getNextPersonId = () => {
            const id = people[personIndex].id;
            personIndex = (personIndex + 1) % people.length; // Loop around if we run out (some people get >1 connection)
            return id;
        };

        const getRandomType = () => relTypes[Math.floor(Math.random() * relTypes.length)].id;

        for (let i = 0; i < totalOrgs; i++) {
            const orgId = shuffledOrgs[i].id;
            let connectionCount = 0;

            if (i < groupAOrgs) {
                // Large groups: 95 to 105 connections
                connectionCount = getRandInt(95, 105);
            } else if (i < groupAOrgs + groupBOrgs) {
                // Medium groups: 3 to 10 connections
                connectionCount = getRandInt(3, 10);
            } else {
                // Small groups: exactly 1 connection
                connectionCount = 1;
            }

            for (let j = 0; j < connectionCount; j++) {
                relationships.push({
                    tenant_id: tenantId,
                    source_id: getNextPersonId(), // Person is usually the source (Employee)
                    target_id: orgId,             // Target is Employer
                    type_id: getRandomType(),
                    metadata: { title: "Generated Entity" }
                });
            }
        }

        console.log(`Generated ${relationships.length} relationships in memory. Inserting in batches...`);

        const BATCH_SIZE = 1000;
        for (let i = 0; i < relationships.length; i += BATCH_SIZE) {
            const batch = relationships.slice(i, i + BATCH_SIZE);
            const { error: insErr } = await supabase.from('entity_relationships').insert(batch);
            if (insErr) {
                console.error(`Error inserting batch at index ${i}:`, insErr.message);
                // Optionally throw insErr if you want it to fail completely
            }
        }

        console.log("✅ Relationship seeding complete!");
        process.exit(0);

    } catch (e) {
        console.error("Fatal error during seeding:", e);
        process.exit(1);
    }
}

run();
