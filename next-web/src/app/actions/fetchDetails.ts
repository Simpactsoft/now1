"use server";

import { createClient } from "@/lib/supabase/server";

export async function fetchPersonDetails(tenantId: string, personId: string) {
    const supabase = await createClient();

    // Parallel fetch for profile and timeline
    const [profileResult, timelineResult] = await Promise.all([
        supabase.rpc("fetch_person_profile", {
            arg_tenant_id: tenantId,
            arg_person_id: personId
        }),
        supabase.rpc("fetch_person_timeline", {
            arg_tenant_id: tenantId,
            arg_person_id: personId,
            arg_limit: 50
        })
    ]);

    if (profileResult.error) {
        console.error("fetch_person_profile error:", profileResult.error);
        return { error: profileResult.error.message };
    }

    if (timelineResult.error) {
        console.error("fetch_person_timeline error:", timelineResult.error);
        // We don't fail the whole page if timeline fails, just return empty
    }

    return {
        profile: profileResult.data?.[0] || null,
        timeline: timelineResult.data || []
    };
}
