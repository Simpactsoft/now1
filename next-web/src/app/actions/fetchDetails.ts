"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function fetchPersonDetails(tenantId: string, personId: string): Promise<ActionResult<{ profile: any; timeline: any[] }>> {
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
        return actionError(profileResult.error.message, "DB_ERROR");
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
        } else if (cardData.contact_methods && typeof cardData.contact_methods === 'object') {
            // Handle Flat Object format (e.g. { phone: "...", email: "..." })
            const m = cardData.contact_methods as any;
            if (m.email) profile.email = m.email;
            if (m.phone) profile.phone = m.phone;
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

    return actionSuccess({
        profile,
        timeline: timelineResult.data || []
    });
}

export async function fetchOrganizationDetails(tenantId: string, orgId: string): Promise<ActionResult<{ profile: any; timeline: any[] }>> {
    const supabase = await createClient();

    const [profileResult, timelineResult, directCardResult] = await Promise.all([
        supabase.rpc("fetch_organization_profile", {
            arg_tenant_id: tenantId,
            arg_org_id: orgId
        }),
        supabase.rpc("fetch_person_timeline", {
            arg_tenant_id: tenantId,
            arg_person_id: orgId,
            arg_limit: 50
        }),
        // [New] Direct Fetch Fallback
        supabase.from('cards')
            .select('custom_fields, contact_methods, status')
            .eq('id', orgId)
            .eq('tenant_id', tenantId)
            .maybeSingle()
    ]);

    if (profileResult.error) {
        console.error("fetchOrganizationDetails error:", profileResult.error);
        return actionError(profileResult.error.message, "DB_ERROR");
    }

    const org = profileResult.data?.[0];

    if (!org) return actionSuccess({ profile: null, timeline: [] });

    // [New] Merge Logic (Same as Person)
    // We prefer directCardResult if available (freshest), but fallback to RPC returned raw fields (ret_*) if RLS blocks direct fetch.
    const rawCustomFields = directCardResult.data?.custom_fields || org.ret_custom_fields;
    const rawContactMethods = directCardResult.data?.contact_methods || org.ret_contact_methods;

    // Merge Custom Fields
    if (rawCustomFields) {
        org.custom_fields = { ...(org.custom_fields || {}), ...rawCustomFields };
    }

    // Handle Contact Methods (Array or Object)
    if (Array.isArray(rawContactMethods)) {
        const emailObj = rawContactMethods.find((m: any) => m.type === 'email');
        const phoneObj = rawContactMethods.find((m: any) => m.type === 'phone');
        const websiteObj = rawContactMethods.find((m: any) => m.type === 'website');

        if (emailObj && !org.email) org.email = emailObj.value;
        if (phoneObj && !org.phone) org.phone = phoneObj.value;
        if (websiteObj && !org.website) org.website = websiteObj.value;
    } else if (rawContactMethods && typeof rawContactMethods === 'object') {
        // Fallback for Legacy Object Format
        const m = rawContactMethods as any;
        if (m.email && !org.email) org.email = m.email;
        if (m.phone && !org.phone) org.phone = m.phone;
        if (m.website && !org.website) org.website = m.website;
    }

    // Also check custom_fields for direct values (Priority: Top Level > Custom Fields > Contact Methods)
    // Actually, usually Top Level (from RPC columns) is already populated from p.custom_fields by the RPC.
    // But if RPC logic missed it (e.g. website not in top level custom field but in ret_custom_fields due to specific logic), we catch it here.
    if (!org.email && rawCustomFields?.email) org.email = rawCustomFields.email;
    if (!org.phone && rawCustomFields?.phone) org.phone = rawCustomFields.phone;
    if (!org.website && rawCustomFields?.website) org.website = rawCustomFields.website;

    return actionSuccess({
        profile: org,
        timeline: timelineResult.data || []
    });
}
