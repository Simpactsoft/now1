'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getSearchHistory(tenantId: string, userId?: string) {
    console.log(`[SearchHistory] GET called with:`, { tenantId, userId });
    try {
        const supabase = await createClient();

        // Use SECURITY DEFINER RPC to bypass RLS issues (since server session might be stale)
        const params: any = { p_tenant_id: tenantId };
        if (userId) params.p_user_id = userId;

        const { data, error } = await supabase.rpc('get_search_history_secure', params);

        if (error) {
            console.error('[ServerAction] getSearchHistory RPC Error:', error);
            // Fallback: Return empty if RPC fails
            return { success: false, error: error.message };
        }

        // Client-side Unique Filter (RPC returns raw rows)
        const uniqueTerms = Array.from(new Set(data?.map((item: any) => item.term) || []));

        console.log(`[SearchHistory] GET Success. Terms: ${uniqueTerms.length}`);
        return {
            success: true,
            history: uniqueTerms,
            debug: {
                receivedUserId: userId,
                receivedTenantId: tenantId,
                rawRows: data?.length || 0,
                rpcName: 'get_search_history_secure'
            }
        };
    } catch (error) {
        console.error('[ServerAction] getSearchHistory Exception:', error);
        return { success: false, error: 'Internal Server Error' };
    }
}


export async function addToSearchHistory(tenantId: string, term: string, userId?: string) {
    console.log(`[SearchHistory] ADD called:`, { tenantId, term, userId });
    try {
        const supabase = await createClient();

        const params: any = {
            p_tenant_id: tenantId,
            p_term: term
        };
        if (userId) params.p_user_id = userId;

        // Use SECURITY DEFINER RPC to bypass RLS issues (since server session might be stale)
        const { data, error } = await supabase.rpc('submit_search_history_secure', params);

        if (error) {
            console.error('[SearchHistory] RPC INVOCATION ERROR:', error);
            return { success: false, error: error.message };
        }

        // RPC returns { success: boolean, error?: string }
        // We MUST check this logical error, otherwise we silence failures.
        if (data && !data.success) {
            console.error('[SearchHistory] LOGICAL SAVE ERROR:', data.error);
            return { success: false, error: data.error || 'Unknown Save Error' };
        }

        console.log('[SearchHistory] Save Success');
        return { success: true };
    } catch (error) {
        console.error('[ServerAction] addToSearchHistory Exception:', error);
        return { success: false, error: 'Internal Server Error' };
    }
}

export async function clearSearchHistory(tenantId: string) {
    const supabase = await createClient();

    try {
        const { error } = await supabase.rpc('wipe_search_history', {
            p_tenant_id: tenantId
        });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
