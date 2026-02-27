
"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionOk, actionError } from "@/lib/action-result";

export async function fetchRelationshipTypesAction(tenantId: string) {
    const supabase = await createServerClient();
    try {
        const { data, error } = await supabase
            .from('relationship_types')
            .select('name')
            .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

        if (error) throw error;

        // Return unique names formatted for the Smart Chip Dropdown Options
        const uniqueNames = Array.from(new Set(data.map(d => d.name)));
        return uniqueNames.map(name => ({
            value: name,
            label: name
        }));
    } catch (error: any) {
        console.error("fetchRelationshipTypesAction error:", error);
        return [];
    }
}

export async function fetchGlobalRelationshipsAction(params: {
    tenantId: string;
    startRow: number;
    endRow: number;
    filterModel?: any;
    sortModel?: any[];
    query?: string;
}) {
    const supabase = await createServerClient();
    const { tenantId, startRow, endRow, filterModel = {}, sortModel = [], query } = params;

    const limit = endRow - startRow;

    // Normalize filters to match what the RPC expects.
    // The RPC uses jsonb_array_elements() for these fields, so values MUST be JSON arrays.
    const toArray = (val: any) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string' && val.includes(',')) return val.split(',').map((s: string) => s.trim()).filter(Boolean);
        return [val];
    };
    const rpcFilters: any = {};
    if (query) rpcFilters.search = query;
    if (filterModel.rel_type_name) rpcFilters.type_name = toArray(filterModel.rel_type_name.filter);
    if (filterModel.source_type) rpcFilters.source_type = toArray(filterModel.source_type.filter);
    if (filterModel.target_type) rpcFilters.target_type = toArray(filterModel.target_type.filter);

    const sortCol = sortModel[0]?.colId || 'created_at';
    const sortDir = sortModel[0]?.sort || 'desc';

    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("fetch_global_relationships_crm", {
            arg_tenant_id: tenantId,
            arg_start: startRow,
            arg_limit: limit,
            arg_sort_col: sortCol,
            arg_sort_dir: sortDir,
            arg_filters: rpcFilters,
        });

        if (rpcError) throw rpcError;

        let finalData = rpcData || [];
        const rowCount = (finalData.length > 0) ? (finalData[0].ret_total_count || 0) : 0;

        // Note: The UI grid expects flat objects
        finalData = finalData.map((row: any) => ({
            id: row.ret_id,
            relationshipId: row.ret_id,
            created_at: row.ret_created_at,
            metadata: row.ret_metadata || {},
            source_id: row.source_id,
            source_name: row.source_name,
            source_type: row.source_type,
            source_avatar_url: row.source_avatar_url,
            source_email: row.source_email,
            source_phone: row.source_phone,
            target_id: row.target_id,
            target_name: row.target_name,
            target_type: row.target_type,
            target_avatar_url: row.target_avatar_url,
            target_email: row.target_email,
            target_phone: row.target_phone,
            rel_type_name: row.rel_type_name
        }));

        return { rowData: finalData, rowCount: Number(rowCount) };
    } catch (error: any) {
        console.error("fetchGlobalRelationshipsAction error:", error);
        return { error: error.message };
    }
}

export async function fetchRelationshipsAction(tenantId: string, entityId: string): Promise<ActionResult<any[]>> {
    const supabase = await createServerClient();

    try {
        // Try Standard RPC first
        let { data, error } = await supabase.rpc('get_entity_relationships', { p_entity_id: entityId });

        if (error) {
            console.error("Standard RPC failed. Trying Service Role...", error);
            const adminClient = createAdminClient();
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
            const adminClient = createAdminClient();
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
                        // Robust Contact Methods extraction (supports both array and legacy object)
                        email: Array.isArray(card.contact_methods)
                            ? card.contact_methods.find((m: any) => m.type === 'email')?.value || ''
                            : (card.contact_methods?.email || ''),
                        phone: Array.isArray(card.contact_methods)
                            ? card.contact_methods.find((m: any) => m.type === 'phone')?.value || ''
                            : (card.contact_methods?.phone || ''),
                        // Preserve Relationship Metadata
                        relationshipId: rel?.id,
                        relationshipType: rel?.type,
                        metadata: rel?.metadata // Include Metadata
                    };
                });
                return actionSuccess(enriched);
            }
        }

        return actionSuccess([]); // No relationships found
    } catch (e: any) {
        console.error("fetchRelationships error", e);
        return actionError(e.message);
    }
}

// Update Add Action to accept Metadata
export async function addRelationshipAction(tenantId: string, sourceId: string, targetId: string, typeName: string, metadata: any = {}): Promise<ActionResult<void>> {
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
        return actionOk();
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Add relationship failed", e);
        return actionError(e.message);
    }
}

export async function removeRelationshipAction(tenantId: string, relId: string): Promise<ActionResult<void>> {
    const supabase = await createServerClient();

    try {
        const { error } = await supabase.from('entity_relationships').delete().eq('id', relId);
        if (error) throw error;
        revalidatePath('/dashboard');
        return actionOk();
    } catch (e: any) {
        console.error("Remove relationship failed", e);
        return actionError(e.message);
    }
}

export async function updateRelationshipAction(tenantId: string, relId: string, typeName: string, metadata: any = null): Promise<ActionResult<void>> {
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
        return actionOk();
    };

    try {
        return await execute(supabase);
    } catch (e: any) {
        console.error("Update relationship failed", e);
        return actionError(e.message);
    }
}
