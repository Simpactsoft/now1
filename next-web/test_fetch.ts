import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function main() {
    const tenantId = '00000000-0000-0000-0000-000000000003';
    // Let's get a person ID for this tenant
    const { data: cards, error } = await supabase.from('cards').select('id, type').eq('tenant_id', tenantId).limit(1);
    if (error || !cards || cards.length === 0) {
        console.error("No cards found", error);
        return;
    }
    const personId = cards[0].id;
    console.log("Testing with personId:", personId, "type:", cards[0].type);

    const [profileResult, timelineResult, directCardResult, membershipResult] = await Promise.all([
        supabase.rpc("fetch_person_profile", {
            arg_tenant_id: tenantId,
            arg_person_id: personId
        }),
        supabase.rpc("fetch_person_timeline", {
            arg_tenant_id: tenantId,
            arg_person_id: personId,
            arg_limit: 50
        }),
        supabase.from('cards')
            .select('custom_fields, contact_methods, status')
            .eq('id', personId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
        supabase.from('party_memberships')
            .select('role_name')
            .eq('person_id', personId)
            .eq('tenant_id', tenantId)
            .maybeSingle()
    ]);

    console.log("profileResult:", profileResult);
    console.log("directCardResult error:", directCardResult.error);
    console.log("membershipResult error:", membershipResult.error);
}

main().catch(console.error);
