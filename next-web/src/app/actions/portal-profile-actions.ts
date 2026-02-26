"use server";

import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getPortalSession } from "./portal-auth";

export async function getPortalProfile(): Promise<ActionResult<any>> {
    try {
        const portalSession = await getPortalSession();
        let userEmail: string | null = null;
        let userId: string | null = null;
        let cardId: string | null = portalSession?.cardId || null;

        if (!cardId) {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                userEmail = user.email;
                userId = user.id;
            }
        }

        if (!userEmail && !cardId) {
            return actionError("Not authenticated", "UNAUTHORIZED");
        }

        const adminClient = createAdminClient();

        if (cardId) {
            // First check cards (Source of truth in CRM)
            const { data: card } = await adminClient.from('cards').select('*').eq('id', cardId).limit(1).single();
            if (card) {
                const customFields = typeof card.custom_fields === 'object' && card.custom_fields !== null ? card.custom_fields : {};

                // Hydrate B2C fields: force display_name to override first_name/last_name to avoid English/Hebrew splits
                let firstName = card.first_name;
                let lastName = card.last_name;
                if (card.display_name) {
                    const parts = card.display_name.trim().split(' ');
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                }

                let emailFromMethod = null;
                let phoneFromMethod = null;
                if (Array.isArray(card.contact_methods)) {
                    emailFromMethod = card.contact_methods.find((m: any) => m.type === 'email')?.value;
                    phoneFromMethod = card.contact_methods.find((m: any) => m.type === 'phone')?.value;
                } else if (typeof card.contact_methods === 'object' && card.contact_methods !== null) {
                    emailFromMethod = (card.contact_methods as any).email;
                    phoneFromMethod = (card.contact_methods as any).phone;
                }

                let email = emailFromMethod || card.email;
                let phone = phoneFromMethod || card.phone;

                return actionSuccess({
                    ...card,
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone: phone,
                    status: customFields.status || card.status || null,
                    source: 'cards'
                });
            }

            // Fallback to legacy parties
            const { data: party } = await adminClient.from('parties').select(`*, people (*)`).eq('id', cardId).limit(1).single();
            if (party) {
                const pp = Array.isArray(party.people) ? party.people[0] : party.people;
                const emailMethod = Array.isArray(party.contact_methods) ? party.contact_methods.find((m: any) => m.type === 'email') : null;
                const phoneMethod = Array.isArray(party.contact_methods) ? party.contact_methods.find((m: any) => m.type === 'phone') : null;
                const customFields = typeof party.custom_fields === 'object' && party.custom_fields !== null ? party.custom_fields : {};

                let firstName = pp?.first_name || '';
                let lastName = pp?.last_name || '';
                if (party.display_name) {
                    const parts = party.display_name.trim().split(' ');
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                }

                return actionSuccess({
                    id: party.id, email: emailMethod?.value, first_name: firstName, last_name: lastName,
                    display_name: party.display_name || `${firstName} ${lastName}`.trim(), avatar_url: party.avatar_url,
                    phone: phoneMethod?.value, status: (customFields as any).status || null, source: 'parties'
                });
            }
            return actionError("Profile not found", "NOT_FOUND");
        }

        // Use the new secure database RPC adapter to check both legacy and modern tables
        const { data: profile, error: profileError } = await adminClient
            .rpc('get_portal_profile', { user_email: userEmail });

        // If RPC succeeds and finds someone, return it
        if (!profileError && profile) {
            const currentProfile = Array.isArray(profile) ? profile[0] : profile;

            let firstName = currentProfile.first_name;
            let lastName = currentProfile.last_name;
            if (currentProfile.display_name) {
                const parts = currentProfile.display_name.trim().split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
            }

            let emailFromMethod = null;
            let phoneFromMethod = null;
            if (Array.isArray(currentProfile.contact_methods)) {
                emailFromMethod = currentProfile.contact_methods.find((m: any) => m.type === 'email')?.value;
                phoneFromMethod = currentProfile.contact_methods.find((m: any) => m.type === 'phone')?.value;
            } else if (typeof currentProfile.contact_methods === 'object' && currentProfile.contact_methods !== null) {
                emailFromMethod = (currentProfile.contact_methods as any).email;
                phoneFromMethod = (currentProfile.contact_methods as any).phone;
            }
            let email = emailFromMethod || currentProfile.email;
            let phone = phoneFromMethod || currentProfile.phone;

            return actionSuccess({
                ...currentProfile,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                source: 'rpc'
            });
        }

        console.warn("[getPortalProfile] RPC failed or absent. Using manual fallback.", profileError?.message);

        // 1. Try legacy cards table (Source of truth in CRM)
        const { data: cards } = await adminClient
            .from('cards')
            .select('*')
            .eq('email', userEmail)
            .limit(1);

        if (cards && cards.length > 0) {
            const card = cards[0];
            const customFields = typeof card.custom_fields === 'object' && card.custom_fields !== null ? card.custom_fields : {};

            let firstName = card.first_name;
            let lastName = card.last_name;
            if (card.display_name) {
                const parts = card.display_name.trim().split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
            }

            let emailFromMethod = null;
            let phoneFromMethod = null;
            if (Array.isArray(card.contact_methods)) {
                emailFromMethod = card.contact_methods.find((m: any) => m.type === 'email')?.value;
                phoneFromMethod = card.contact_methods.find((m: any) => m.type === 'phone')?.value;
            } else if (typeof card.contact_methods === 'object' && card.contact_methods !== null) {
                emailFromMethod = (card.contact_methods as any).email;
                phoneFromMethod = (card.contact_methods as any).phone;
            }

            let email = emailFromMethod || card.email;
            let phone = phoneFromMethod || card.phone;

            return actionSuccess({
                ...card,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                status: customFields.status || card.status || null,
                source: 'cards'
            });
        }

        // 2. Try modern parties table via adminClient
        try {
            const { data: parties, error: partyQueryError } = await adminClient
                .from('parties')
                .select(`
                    id, display_name, avatar_url, contact_methods, custom_fields, type,
                    people (first_name, last_name, gender)
                `)
                .contains('contact_methods', [{ value: userEmail }])
                .limit(1);

            if (!partyQueryError && parties && parties.length > 0) {
                const p = parties[0];
                const pp = Array.isArray(p.people) ? p.people[0] : p.people;

                let firstName = pp?.first_name || '';
                let lastName = pp?.last_name || '';
                let displayName = p.display_name;

                if (displayName) {
                    const parts = displayName.trim().split(' ');
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                } else {
                    displayName = `${firstName} ${lastName}`.trim();
                }

                const phoneMethod = Array.isArray(p.contact_methods) ? p.contact_methods.find((m: any) => m.type === 'phone') : null;
                const customFields = typeof p.custom_fields === 'object' && p.custom_fields !== null ? p.custom_fields : {};

                return actionSuccess({
                    id: p.id,
                    email: userEmail,
                    first_name: firstName,
                    last_name: lastName,
                    display_name: displayName,
                    avatar_url: p.avatar_url,
                    phone: phoneMethod ? phoneMethod.value : null,
                    status: (customFields as any).status || null,
                    source: 'parties'
                });
            }
        } catch (partyErr) {
            console.warn("[getPortalProfile] Could not query parties table.", partyErr);
        }

        console.warn("[getPortalProfile] User authorized but no CRM profile found. Returning auto-fallback.");
        return actionSuccess({
            id: cardId || userEmail || 'unknown',
            email: userEmail,
            first_name: "Portal",
            last_name: "User",
            display_name: "Portal User",
            avatar_url: null,
            phone: null,
            status: null,
            source: 'auth_fallback'
        });

    } catch (e: any) {
        console.error("getPortalProfile error:", e);
        return actionError("Failed to fetch profile");
    }
}

export async function updatePortalProfile(
    data: { first_name: string; last_name: string; email: string; phone: string; job_title?: string; department?: string; }
): Promise<ActionResult<void>> {
    try {
        const portalSession = await getPortalSession();
        let userEmail: string | null = null;
        let cardId: string | null = portalSession?.cardId || null;

        if (!cardId) {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                userEmail = user.email;
            }
        }

        if (!userEmail && !cardId) {
            return actionError("Not authenticated", "UNAUTHORIZED");
        }

        const adminClient = createAdminClient();

        // [New Fix] Handle contact_methods JSON mutation in TS before sending to RPC
        let updatedContactMethods: any = null;

        let profileCheckObj = null;
        if (cardId) {
            const { data } = await adminClient.from('cards').select('contact_methods').eq('id', cardId).limit(1);
            if (data) profileCheckObj = data;
        } else {
            const { data } = await adminClient.from('cards').select('contact_methods').eq('email', userEmail).limit(1);
            if (data) profileCheckObj = data;
        }

        if (profileCheckObj && profileCheckObj.length > 0) {
            let cm = profileCheckObj[0].contact_methods || [];

            // Normalize legacy object to array
            if (typeof cm === 'object' && !Array.isArray(cm) && cm !== null) {
                const arr = [];
                if (userEmail) arr.push({ type: 'email', value: userEmail });
                if (cm.phone) arr.push({ type: 'phone', value: cm.phone });
                cm = arr;
            } else if (typeof cm === 'string') {
                try { cm = JSON.parse(cm); } catch (e) { cm = []; }
            }
            if (!Array.isArray(cm)) cm = [];

            // Add/Update phone
            const existingPhoneIdx = cm.findIndex((m: any) => m.type === 'phone');
            if (existingPhoneIdx >= 0) {
                cm[existingPhoneIdx].value = data.phone;
            } else if (data.phone) {
                cm.push({ type: 'phone', value: data.phone });
            }

            // Add/Update email
            const existingEmailIdx = cm.findIndex((m: any) => m.type === 'email');
            if (existingEmailIdx >= 0) {
                cm[existingEmailIdx].value = data.email;
            } else if (data.email) {
                cm.push({ type: 'email', value: data.email, is_primary: true });
            }

            updatedContactMethods = cm;
        }

        if (userEmail) {
            // Perform the update using the new secure database RPC adapter
            const { error: updateError } = await adminClient
                .rpc('update_portal_profile', {
                    user_email: userEmail,
                    arg_email: data.email,
                    arg_first_name: data.first_name,
                    arg_last_name: data.last_name,
                    arg_phone: data.phone,
                    arg_job_title: data.job_title || null,
                    arg_department: data.department || null,
                    arg_contact_methods: updatedContactMethods
                });

            if (!updateError) {
                revalidatePath('/portal/profile');
                return actionSuccess(undefined);
            }
        }

        // FALLBACK FOR PRODUCTION
        console.warn("[updatePortalProfile] RPC failed or absent. Using manual fallback.");

        const newDisplayName = `${data.first_name} ${data.last_name}`.trim();

        // 1. Try Legacy Cards (Source of truth)
        let cardsQuery = adminClient.from('cards').select('id, custom_fields').limit(1);
        if (cardId) {
            cardsQuery = cardsQuery.eq('id', cardId);
        } else {
            cardsQuery = cardsQuery.eq('email', userEmail);
        }

        const { data: cards } = await cardsQuery;
        if (cards && cards.length > 0) {
            const currentMetadata = typeof cards[0].custom_fields === 'object' && cards[0].custom_fields !== null ? cards[0].custom_fields : {};
            await adminClient.from('cards').update({
                first_name: data.first_name,
                last_name: data.last_name,
                display_name: newDisplayName,
                email: data.email,
                phone: data.phone,
                job_title: data.job_title,
                contact_methods: updatedContactMethods,
                custom_fields: { ...currentMetadata, job_title: data.job_title, department: data.department, role: data.job_title }
            }).eq('id', cards[0].id);

            // [Fix] Sync role to party memberships for CRM backwards compatibility
            // Also try to sync the legacy 'parties' table so they don't drift further
            try {
                await adminClient.from('party_memberships').update({ role_name: data.job_title }).eq('person_id', cards[0].id);
                await adminClient.from('people').update({ first_name: data.first_name, last_name: data.last_name }).eq('party_id', cards[0].id);
                await adminClient.from('parties').update({ display_name: newDisplayName, contact_methods: updatedContactMethods }).eq('id', cards[0].id);
            } catch (ignore) { }

            revalidatePath('/portal/profile');
            return actionSuccess(undefined);
        }

        // 2. Try modern parties table via adminClient
        try {
            const { data: parties, error: partyQueryError } = await adminClient
                .from('parties')
                .select('id, custom_fields, contact_methods')
                .contains('contact_methods', [{ value: userEmail }])
                .limit(1);

            if (!partyQueryError && parties && parties.length > 0) {
                const pId = parties[0].id;
                const customFields = typeof parties[0].custom_fields === 'object' && parties[0].custom_fields !== null ? parties[0].custom_fields : {};

                // Find existing contact methods or initialize
                const party = parties[0] as any;
                let contactMethods = party.contact_methods || [];
                if (typeof contactMethods === 'string') contactMethods = JSON.parse(contactMethods as any);
                if (!Array.isArray(contactMethods)) contactMethods = [];

                // Update phone method
                const phoneIndex = contactMethods.findIndex((m: any) => m.type === 'phone');
                if (phoneIndex >= 0) {
                    contactMethods[phoneIndex].value = data.phone;
                } else if (data.phone) {
                    contactMethods.push({ type: 'phone', value: data.phone });
                }

                // Update email method
                const emailIndex = contactMethods.findIndex((m: any) => m.type === 'email');
                if (emailIndex >= 0) {
                    contactMethods[emailIndex].value = data.email;
                } else if (data.email) {
                    contactMethods.push({ type: 'email', value: data.email, is_primary: true });
                }

                await adminClient.from('parties').update({
                    display_name: newDisplayName,
                    custom_fields: { ...customFields, job_title: data.job_title, department: data.department, role: data.job_title },
                    contact_methods: contactMethods
                }).eq('id', pId);

                await adminClient.from('people').update({
                    first_name: data.first_name,
                    last_name: data.last_name
                }).eq('party_id', pId);

                await adminClient.from('party_memberships').update({
                    role_name: data.job_title
                }).eq('person_id', pId);

                revalidatePath('/portal/profile');
                return actionSuccess(undefined);
            }
        } catch (partyErr) {
            console.warn("[updatePortalProfile] Could not update parties table.", partyErr);
        }

        // 3. AUTO-FALLBACK: If auth user exists but no CRM record, return error instead of faking success
        console.warn("[updatePortalProfile] No CRM record found to update. Returning explicit error.");
        return actionError("Cannot save profile. Your account is not linked to a CRM contact. Please test with a valid customer.", "ORPHAN_USER");
    } catch (e: any) {
        console.error("updatePortalProfile error:", e);
        return actionError("Failed to update profile", "UPDATE_ERROR");
    }
}
