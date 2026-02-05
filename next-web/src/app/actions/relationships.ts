
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

        // Transform to frontend format (Basic)
        const basicRelationships = (data || []).map((r: any) => ({
            id: r.rel_id,
            target: {
                id: r.target_id,
                name: r.target_name,
                type: r.target_type,
                avatarUrl: null // Placeholder
            },
            type: {
                id: r.rel_type_id,
                name: r.rel_type
            },
            metadata: r.metadata // Map metadata
        }));

        // Enrich with Full Card Data (Admin Client to bypass RLS for visibility consistency)
        if (basicRelationships.length > 0) {
            const adminClient = getAdminClient();
            const ids = basicRelationships.map((r: any) => r.target.id);
            const { data: cardsData, error: cardsError } = await adminClient
                .from('cards')
                .select('*')
                .in('id', ids)
                .eq('tenant_id', tenantId); // Security: Enforce tenant boundary

            if (!cardsError && cardsData) {
                // Return enriched objects compatible with SimplePeopleTable
                const enriched = cardsData.map((card: any) => {
                    const rel = basicRelationships.find((r: any) => r.target.id === card.id);
                    return {
                        ...card,
                        ret_id: card.id,
                        ret_name: card.display_name,
                        ret_avatar_url: card.avatar_url,
                        ret_status: card.status || card.custom_fields?.status,
                        ret_role_name: rel?.type.name, // Relationship Type as Role
                        ret_tags: card.tags,
                        ret_last_interaction: card.last_interaction_at,
                        // Robust Contact Methods extraction (matches fetchDetails logic)
                        email: card.contact_methods?.email || (typeof card.contact_methods === 'object' ? (card.contact_methods as any).email : ''),
                        phone: card.contact_methods?.phone || (typeof card.contact_methods === 'object' ? (card.contact_methods as any).phone : ''),
                        // Preserve Relationship Metadata
                        relationshipId: rel?.id,
                        relationshipType: rel?.type,
                        metadata: rel?.metadata // Include Metadata
                    };
                });
                return { data: enriched };
            }
        }

        return { data: [] }; // No relationships found
    } catch (e: any) {
        console.error("fetchRelationships error", e);
        return { error: e.message };
    }
}

// Update Add Action to accept Metadata
export async function addRelationshipAction(tenantId: string, sourceId: string, targetId: string, typeName: string, metadata: any = {}) {
    const supabase = await createServerClient();

    // RPC Logic
    const execute = async (client: any) => {
        const { data, error } = await client.rpc('add_entity_relationship', {
            p_tenant_id: tenantId,
            p_source_id: sourceId,
            p_target_id: targetId,
            p_type_name: typeName,
            p_metadata: metadata
        });

        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Add relationship failed", e);
        return { error: e.message };
    }
}

export async function removeRelationshipAction(tenantId: string, relId: string) {
    const supabase = await createServerClient();

    try {
        const { error } = await supabase.from('entity_relationships').delete().eq('id', relId);
        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error("Remove relationship failed", e);
        return { error: e.message };
    }
}

export async function updateRelationshipAction(tenantId: string, relId: string, typeName: string, metadata: any = null) {
    const supabase = await createServerClient();

    const execute = async (client: any) => {
        const { data, error } = await client.rpc('update_entity_relationship', {
            p_tenant_id: tenantId,
            p_rel_id: relId,
            p_type_name: typeName,
            p_metadata: metadata
        });

        if (error) throw error;
        revalidatePath('/dashboard');
        return { success: true };
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Update relationship failed", e);
        return { error: e.message };
    }
}
