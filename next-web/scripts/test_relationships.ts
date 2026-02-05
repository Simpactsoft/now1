
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Starting Relationship Test...");

    // 1. Create Tenant
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Mock or use existing if known valid

    // 2. Create Person A and B
    // We assume 'cards' table is populated via triggers on 'people' or manually. 
    // For this test, let's insert into 'people' if possible, or directly to 'cards' if that's the source of truth for the join.
    // The RPC joins on `cards`. Let's check `cards` dependency.
    // If cards are views, we insert into people.

    // Let's create dummy people using the RPC logic from actions (which calls create_person).
    // Or simpler: direct SQL inject for test.

    // Actually, let's try to just use existing data if we can, or insert minimal mock data.

    // Fetch 2 existing people to test with
    const { data: people, error: fetchErr } = await supabase
        .from('cards')
        .select('id')
        .eq('type', 'person')
        .limit(2);

    if (fetchErr || !people || people.length < 2) {
        console.error("Could not find 2 people to test with.", fetchErr);
        return;
    }

    const idA = people[0].id;
    const idB = people[1].id;
    console.log("Using Person A:", idA);
    console.log("Using Person B:", idB);

    // 3. Link A -> B (Type: 'TestLink')
    // We use add_entity_relationship RPC
    const { data: relId, error: relErr } = await supabase.rpc('add_entity_relationship', {
        p_tenant_id: tenantId,
        p_source_id: idA,
        p_target_id: idB,
        p_type_name: 'TestLink'
    });
    if (relErr) { console.error("Error linking", relErr); return; }
    console.log("Linked A -> B, RelID:", relId);

    // 4. Fetch Relationships for A (Forward)
    const { data: relsA, error: errFetchA } = await supabase.rpc('get_entity_relationships', { p_entity_id: idA });
    if (errFetchA) console.error("Error fetching A", errFetchA);
    console.log("A Relationships (Forward):", relsA?.length, relsA);

    // 5. Fetch Relationships for B (Inverse)
    const { data: relsB, error: errFetchB } = await supabase.rpc('get_entity_relationships', { p_entity_id: idB });
    if (errFetchB) console.error("Error fetching B", errFetchB);
    console.log("B Relationships (Inverse):", relsB?.length, relsB);

    // Cleanup
    await supabase.from('entity_relationships').delete().eq('id', relId);
    console.log("Cleanup done.");
}

test();
