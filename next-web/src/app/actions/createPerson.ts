"use server";

import { createClient } from "@/lib/supabase/server";
import { CreatePersonSchema, CreatePersonInput } from "@/lib/schemas";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function createPerson(params: CreatePersonInput) {
    const supabase = await createClient();

    // 1. Validate Input (Manual Validation to bypass Zod crash)
    const { firstName, lastName, email, phone, tenantId, customFields, tags } = params as any;
    console.log("createPerson: Received inputs:", { firstName, lastName, email, phone, tenantId, customFields, tags });

    const errors: string[] = [];

    if (!firstName || firstName.length < 1) errors.push("First Name is required");
    if (!lastName || lastName.length < 1) errors.push("Last Name is required");
    if (!tenantId || tenantId.length < 1) errors.push("Tenant ID is required");

    if (errors.length > 0) {
        console.warn("createPerson: Validation failed:", errors);
        return { success: false, error: errors.join(', ') };
    }

    // Remove result.data access since we have params
    // const { firstName, lastName, email, phone, tenantId } = result.data; 
    // ^ Already destructured above

    try {
        // 2. Call RPC - Attempt with NEW signature (supports custom_fields)
        console.log("createPerson: Calling RPC create_person with tags:", tags);
        const { data, error } = await supabase.rpc('create_person', {
            arg_tenant_id: tenantId,
            arg_first_name: firstName,
            arg_last_name: lastName,
            arg_email: email || null,
            arg_phone: phone || null,
            arg_custom_fields: customFields || {},
            arg_tags: tags || [],
            arg_organization_id: null
        });

        console.log("createPerson: RPC Arguments:", {
            arg_tenant_id: tenantId,
            arg_first_name: firstName,
            arg_last_name: lastName,
            arg_email: email || null,
            arg_phone: phone || null,
            arg_organization_id: null
        });

        if (!error) {
            console.log("createPerson: RPC success. Created Data:", data);
        }

        if (error) {
            console.warn("createPerson: RPC Error (New Signature):", error.message);

            // Check for Schema Mismatch (function not found)
            if (error.message?.includes('Could not find the function') || error.message?.includes('argument name')) {
                console.warn("createPerson: RPC signature mismatch. Falling back to legacy signature.");

                // Fallback: Call OLD signature
                const { data: fallbackData, error: fallbackError } = await supabase.rpc('create_person', {
                    arg_tenant_id: tenantId,
                    arg_first_name: firstName,
                    arg_last_name: lastName,
                    arg_email: email || null,
                    arg_phone: phone || null
                });

                if (fallbackError) {
                    console.error("createPerson: Legacy RPC Error:", fallbackError);
                    throw fallbackError;
                }

                // Post-process: Update custom_fields and tags manually using ADMIN client to bypass RLS
                const updates: any = {};
                if (customFields && Object.keys(customFields).length > 0) updates.custom_fields = customFields;
                if (tags && tags.length > 0) updates.tags = tags;

                if (Object.keys(updates).length > 0) {
                    console.log("createPerson: Manually updating fields for", fallbackData.id, updates);

                    // Initialize Admin Client on demand
                    const { createClient: createAdminClient } = require('@supabase/supabase-js');
                    const supabaseAdmin = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!,
                        { auth: { persistSession: false } }
                    );

                    const { error: updateError } = await supabaseAdmin.from('cards').update(updates).eq('id', fallbackData.id);

                    if (updateError) {
                        console.error("createPerson: Failed to manually update fields:", updateError);
                    } else {
                        console.log("createPerson: Manual update successful");
                    }
                }

                revalidatePath('/dashboard/people');
                return { success: true, data: fallbackData };
            }
            throw error;
        }

        // 3. Revalidate & Return
        revalidatePath('/dashboard/people');
        return { success: true, data };

    } catch (error: any) {
        console.error("createPerson Exception:", error);
        return { success: false, error: error.message };
    }
}
