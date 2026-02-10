
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const supabase = await createClient();

    // Probe columns
    const columnsToProbe = ['list_price', 'sales_price', 'cost_price', 'track_inventory', 'archived', 'deleted_at'];
    const results: any = {};

    for (const col of columnsToProbe) {
        const { error } = await supabase.from('products').select(col).limit(1);
        results[col] = error ? error.message : "EXISTS";
    }

    // Probe Relation
    const { error: relError } = await supabase.from('products').select('*, product_categories(name)').limit(1);
    results['relation_check'] = relError ? relError.message : "EXISTS";

    return NextResponse.json(results);
}
