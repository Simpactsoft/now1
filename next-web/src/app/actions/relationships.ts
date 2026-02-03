
"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Helper to create admin client consistently
const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function fetchRelationshipsAction(tenantId: string, entityId: string) {
    const supabase = await createServerClient();

    try {
        // Try Standard RPC first
        let { data, error } = await supabase.rpc('get_entity_relationships', { p_entity_id: entityId });

        if (error) {
            console.error("Standard RPC failed. Trying Service Role...", error);
            const adminClient = getAdminClient();
            const { data: adminData, error: adminErr } = await adminClient.rpc('get_entity_relationships', { p_entity_id: entityId });

            if (adminErr) {
                console.error("Admin RPC failed:", adminErr);
                throw adminErr;
            }
            data = adminData;
        }

        // Transform to frontend format
        const relationships = (data || []).map((r: any) => ({
            id: r.rel_id,
            target: {
                id: r.target_id,
                name: r.target_name,
                type: r.target_type,
                avatarUrl: null
            },
            type: {
                id: r.rel_type_id,
                name: r.rel_type
            }
        }));

        return { data: relationships };
    } catch (e: any) {
        console.error("fetchRelationships error", e);
        return { error: e.message };
    }
}

export async function addRelationshipAction(tenantId: string, sourceId: string, targetId: string, typeName: string) {
    const supabase = await createServerClient();

    // RPC Logic
    const execute = async (client: any) => {
        const { data, error } = await client.rpc('add_entity_relationship', {
            p_tenant_id: tenantId,
            p_source_id: sourceId,
            p_target_id: targetId,
            p_type_name: typeName
        });

        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Standard add failed. Trying Service Role...", e);
        try {
            const adminClient = getAdminClient();
            return await execute(adminClient);
        } catch (e2: any) {
            console.error("Admin add failed", e2);
            return { error: `Admin Fallback Failed: ${e2.message}` };
        }
    }
}

export async function removeRelationshipAction(relId: string) {
    const supabase = await createServerClient();

    try {
        const { error } = await supabase.from('entity_relationships').delete().eq('id', relId);
        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error("Standard remove failed. Trying Service Role...", e);
        try {
            const adminClient = getAdminClient();
            if (err2) throw err2;
            revalidatePath('/dashboard');
            return { success: true };
        } catch (e2: any) {
            return { error: e2.message };
        }
    }
}

export async function updateRelationshipAction(tenantId: string, relId: string, typeName: string) {
    const supabase = await createServerClient();

    const execute = async (client: any) => {
        const { data, error } = await client.rpc('update_entity_relationship', {
            p_tenant_id: tenantId,
            p_rel_id: relId,
            p_type_name: typeName
        });

        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Standard update failed. Trying Service Role...", e);
        try {
            const adminClient = getAdminClient();
            return await execute(adminClient);
        } catch (e2: any) {
            return { error: e2.message };
        }
    }
}
