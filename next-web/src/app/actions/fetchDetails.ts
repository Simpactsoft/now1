"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchPersonDetails(tenantId: string, personId: string) {
    const supabase = await createClient();

    // Parallel fetch for profile, timeline, and direct custom_fields (fallback for stale RPC)
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
        // Use Standard Client (Respects RLS)
        supabase.from('cards')
            .select('custom_fields, contact_methods, status')
            .eq('id', personId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
        // [New] Fetch Role (Job Title) manually
        supabase.from('party_memberships')
            .select('role_name')
            .eq('person_id', personId)
            .eq('tenant_id', tenantId)
            .maybeSingle()
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
    if (profile && directCardResult.data) {
        const cardData = directCardResult.data;

        // Merge Status
        if (!profile.status && cardData.status) profile.status = cardData.status;

        // Merge Custom Fields
        if (cardData.custom_fields) {
            profile.custom_fields = { ...(profile.custom_fields || {}), ...cardData.custom_fields };
        }

        // [Fix] Robust Contact Methods Check
        if (Array.isArray(cardData.contact_methods)) {
            const methods = cardData.contact_methods as any[];
            const emailObj = methods.find((m: any) => m.type === 'email');
            const phoneObj = methods.find((m: any) => m.type === 'phone');

            if (emailObj) profile.email = emailObj.value;
            if (phoneObj) profile.phone = phoneObj.value;
        }

        // Priority: Membership Role > Custom Fields Role
        const membershipRole = membershipResult.data?.role_name;
        const customFieldsRole = cardData.custom_fields?.role;

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
