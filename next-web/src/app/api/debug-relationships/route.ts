import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();

        const results: any = {};

        // 1. Check entity_relationships
        const { count: erCount, error: erErr } = await supabase
            .from('entity_relationships')
            .select('*', { count: 'exact', head: true });
        results.entity_relationships = { count: erCount, error: erErr };

        // 2. Check party_memberships (old architecture?)
        const { count: pmCount, error: pmErr } = await supabase
            .from('party_memberships')
            .select('*', { count: 'exact', head: true });
        results.party_memberships = { count: pmCount, error: pmErr };

        if (pmCount && pmCount > 0) {
            const { data } = await supabase.from('party_memberships').select('*').limit(5);
            results.party_memberships_sample = data;
        }

        // 3. Are there other relation tables? We can't query information_schema easily via postgrest.
        // Let's check user_hierarchy_history just in case
        const { count: uhCount, error: uhErr } = await supabase
            .from('user_hierarchy_history')
            .select('*', { count: 'exact', head: true });
        results.user_hierarchy_history = { count: uhCount, error: uhErr };

        return NextResponse.json(results);

    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
