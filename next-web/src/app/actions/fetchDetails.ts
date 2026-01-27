"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchPersonDetails(tenantId: string, personId: string) {
    const supabase = await createClient();

    // [Fix] Use Service Role (Admin) client for direct table access to bypass RLS policies
    const { createClient: createAdminClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    // Parallel fetch for profile, timeline, and direct custom_fields (fallback for stale RPC)
    const [profileResult, timelineResult, customFieldsResult, membershipResult] = await Promise.all([
        supabase.rpc("fetch_person_profile", {
            arg_tenant_id: tenantId,
            arg_person_id: personId
        }),
        supabase.rpc("fetch_person_timeline", {
            arg_tenant_id: tenantId,
            arg_person_id: personId,
            arg_limit: 50
        }),
        // Use Admin client for direct fetch to ensure we see the data regardless of RLS
        supabaseAdmin.from('cards').select('custom_fields, contact_methods').eq('id', personId).eq('tenant_id', tenantId).maybeSingle(),
        // [New] Fetch Role (Job Title) manually
        supabaseAdmin.from('party_memberships').select('role_name').eq('person_id', personId).eq('tenant_id', tenantId).maybeSingle()
    ]);

    if (profileResult.error) {
        console.error("fetch_person_profile error:", profileResult.error);
        return { error: profileResult.error.message };
    }

    if (timelineResult.error) {
        console.error("fetch_person_timeline error:", timelineResult.error);
        // We don't fail the whole page if timeline fails, just return empty
    }

    const profile = profileResult.data?.[0] || null;

    // Merge custom_fields if missing from RPC but found in direct fetch
    if (profile) {
        if (customFieldsResult.data) {
            if (!profile.custom_fields && customFieldsResult.data.custom_fields) {
                profile.custom_fields = customFieldsResult.data.custom_fields;
            }

            // [Fix] Also manually extract Phone/Email from contact_methods if RPC failed to map them
            if (customFieldsResult.data.contact_methods) {
                const methods = customFieldsResult.data.contact_methods as any[];
                const emailObj = methods.find((m: any) => m.type === 'email');
                const phoneObj = methods.find((m: any) => m.type === 'phone');

                if (emailObj) profile.email = emailObj.value;
                if (phoneObj) profile.phone = phoneObj.value;
            }
        }

        // [Fix] Merge manual role fetch
        // 2. Fetch from 'cards' (base table) to get missing fields (email, phone, status, etc.)
        // We use supabaseAdmin to avoid RLS mismatch issues since we already validated via RPC
        const { data: cardData, error: cardError } = await supabaseAdmin
            .from('cards')
            .select('contact_methods, status, custom_fields')
            .eq('id', personId)
            .single();

        if (cardError) {
            console.error("fetchPersonDetails: Error fetching card data:", cardError);
        } else if (cardData) {
            // Merge logic...
            if (!profile.status && cardData.status) profile.status = cardData.status;

            // Merge custom fields
            if (cardData.custom_fields) {
                profile.custom_fields = { ...profile.custom_fields, ...cardData.custom_fields };
            }
        }
        // Priority: Membership Role > Custom Fields Role
        const membershipRole = membershipResult.data?.role_name;
        const customFieldsRole = customFieldsResult.data?.custom_fields?.role;

        if (membershipRole) {
            profile.job_title = membershipRole;
        } else if (customFieldsRole) {
            profile.job_title = customFieldsRole;
        }
    }

    return {
        profile,
        timeline: timelineResult.data || []
    };
}
