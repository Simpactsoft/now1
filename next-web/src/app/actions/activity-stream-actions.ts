"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/auth/tenant";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

// Define the keyset cursor type representing the last fetched tuple
export interface ActivityStreamCursor {
    lastOccurredAt: string;
    lastId: string;
}

/**
 * Fetches the unified activity stream for a specific entity using Keyset / Cursor Pagination.
 */
export async function fetchActivityStream(
    entityId: string,
    limit: number = 20,
    cursor: ActivityStreamCursor | null = null
): Promise<ActionResult<{ items: any[]; nextCursor: ActivityStreamCursor | null }>> {
    const cookieStore = await cookies();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return actionError("Not authenticated", "AUTH_ERROR");
    }

    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '') || await getTenantId(user, supabase);

    if (!tenantId) {
        return actionError("Not authenticated or missing tenant", "AUTH_ERROR");
    }

    try {
        const adminClient = createAdminClient();
        let query = adminClient
            .from("activity_stream")
            .select("*")
            .eq("organization_id", tenantId)
            .eq("entity_id", entityId)
            .order("occurred_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit);

        if (cursor) {
            // Postgres tuple comparison: (occurred_at, id) < (cursor.lastOccurredAt, cursor.lastId)
            // Translated to PostgREST format: occurred_at < lastOccurredAt OR (occurred_at = lastOccurredAt AND id < lastId)
            query = query.or(`occurred_at.lt.${cursor.lastOccurredAt},and(occurred_at.eq.${cursor.lastOccurredAt},id.lt.${cursor.lastId})`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching activity stream:", error);
            return actionError("Failed to fetch activity stream", "DB_ERROR");
        }

        // Determine the next cursor if we retrieved exactly `limit` items
        let nextCursor: ActivityStreamCursor | null = null;
        if (data.length === limit) {
            const lastItem = data[data.length - 1];
            nextCursor = {
                lastOccurredAt: lastItem.occurred_at,
                lastId: lastItem.id,
            };
        }

        return actionSuccess({ items: data, nextCursor });
    } catch (error) {
        console.error("Unknown error fetching activity stream:", error);
        return actionError("Unknown error occurred", "INTERNAL_ERROR");
    }
}
