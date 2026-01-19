"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPeopleCount(tenantId: string) {
    if (!tenantId) return 0;

    const supabase = await createClient();

    // Efficient count using count(*), assuming index on tenant_id + type exists
    const { count, error } = await supabase
        .from("parties")
        .select('*', { count: 'exact', head: true })
        .eq("tenant_id", tenantId)
        .eq("type", "person");

    if (error) {
        console.error("Error fetching people count:", error);
        return 0;
    }

    return count || 0;
}
