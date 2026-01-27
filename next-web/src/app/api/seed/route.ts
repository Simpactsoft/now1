
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

export async function GET() {
    // 1. Init Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({
            error: "Configuration Error",
            message: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"
        }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log("Admin Seeder Started...");

    // 2. Get Tenant
    const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .ilike('name', 'Orbit Enterprise%')
        .limit(1);

    if (!tenants || tenants.length === 0) return NextResponse.json({ error: "Tenant 'Orbit Enterprise' not found" }, { status: 404 });
    const tenantId = tenants[0].id;

    // 3. Cleanup
    await supabase.from('party_memberships').delete().eq('tenant_id', tenantId);
    await supabase.from('people').delete().in('card_id', (
        await supabase.from('cards').select('id').eq('tenant_id', tenantId).eq('type', 'person')
    ).data?.map(p => p.id) || []);
    await supabase.from('cards').delete().eq('tenant_id', tenantId).eq('type', 'person');
    await supabase.from('cards').delete().eq('tenant_id', tenantId).eq('type', 'organization');

    // 4. Create Org
    const orgId = crypto.randomUUID();
    await supabase.from('cards').insert({
        id: orgId,
        tenant_id: tenantId,
        type: 'organization',
        display_name: 'Acme Corp',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    // 5. Generate People
    const batchSize = 200;
    const newParties = [];
    const newPeople = [];
    const newMemberships = [];

    const firstNames = ['Yossi', 'David', 'Moshe', 'Avraham', 'Sarah', 'Rachel', 'Leah', 'Noa', 'James', 'John', 'Michael', 'Emily', 'Emma'];
    const lastNames = ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Smith', 'Johnson', 'Brown', 'Davis', 'Miller'];
    const statuses = ['lead', 'customer', 'churned', 'partner', 'negotiation'];
    const roles = ['Developer', 'Manager', 'Director', 'VP Sales', 'CEO', 'CTO', 'Designer', 'Product Manager'];

    for (let i = 0; i < batchSize; i++) {
        const id = crypto.randomUUID();
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const role = roles[Math.floor(Math.random() * roles.length)];

        newParties.push({
            id,
            tenant_id: tenantId,
            type: 'person',
            display_name: `${firstName} ${lastName}`,
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: status
        });

        newPeople.push({
            card_id: id,
            first_name: firstName,
            last_name: lastName
        });

        newMemberships.push({
            tenant_id: tenantId,
            person_id: id,
            organization_id: orgId,
            role_name: role,
            created_at: new Date().toISOString()
        });
    }

    // 6. Insert All
    const { error: pErr } = await supabase.from('cards').insert(newParties);
    if (pErr) return NextResponse.json({ error: "Parties: " + pErr.message }, { status: 500 });

    const { error: pplErr } = await supabase.from('people').insert(newPeople);
    if (pplErr) return NextResponse.json({ error: "People: " + pplErr.message }, { status: 500 });

    const { error: mErr } = await supabase.from('party_memberships').insert(newMemberships);
    if (mErr) return NextResponse.json({ error: "Memberships: " + mErr.message }, { status: 500 });

    return NextResponse.json({
        success: true,
        message: `Seeded ${batchSize} records for ${tenantId} WITH ROLES!`,
        tenant_id: tenantId
    });
}
