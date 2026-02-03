
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
        return NextResponse.json({ error: "Tenant ID required" }, { status: 400 });
    }

    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
    }

    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from('cards')
            .select('id, display_name, type, custom_fields')
            .eq('tenant_id', tenantId)
            .ilike('display_name', `%${q}%`)
            .order('display_name', { ascending: true })
            .limit(10);

        if (error) throw error;

        const results = data.map(card => ({
            id: card.id,
            name: card.display_name,
            type: card.type,
            details: card.custom_fields?.role || card.custom_fields?.industry || (card.type === 'person' ? 'Person' : 'Organization')
        }));

        return NextResponse.json({ results });
    } catch (e: any) {
        console.error("Search error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
