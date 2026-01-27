
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || 'PERSON_STATUS';

    // Get Tenant
    const { data: { user } } = await supabase.auth.getUser();
    let tenantId = user?.app_metadata?.tenant_id;

    // Fallback: Check Query Param
    if (!tenantId) {
        tenantId = searchParams.get('tenantId');
    }

    if (!tenantId) {
        return NextResponse.json({ error: "No Tenant ID" }, { status: 401 });
    }

    console.log(`[API] Fetching options for ${code}, Tenant: ${tenantId}`);

    // 1. Get Option Set ID
    // We search for tenant-specific set first, or global set if not found
    // Actually, we generally want the global set ID if it's a global set being extended.
    // Simplifying: Find ANY set with this code accessible to us.
    const { data: sets, error: setError } = await supabase
        .from('option_sets')
        .select('id, tenant_id')
        .eq('code', code)
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`); // RLS handles this, but explicit filter helps logic

    if (setError) {
        console.error("[API] Set Error:", setError);
        return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    if (!sets || sets.length === 0) {
        return NextResponse.json({ data: [] }); // Set not found
    }

    // Logic: If multiple sets found (one global, one tenant override), usually we prefer the tenant one.
    // For now, let's pick the first one (or sort by tenant_id not null).
    // Assuming simple case: GLOBAL set.
    const setId = sets[0].id;

    // 2. Fetch Values
    const { data: rawValues, error: valError } = await supabase
        .from('option_values')
        .select('*')
        .eq('option_set_id', setId)
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .eq('is_active', true);

    if (valError) {
        console.error("[API] Values Error:", valError);
        return NextResponse.json({ error: valError.message }, { status: 500 });
    }

    // 3. Process & Merge (Shadowing Logic)
    // Map internal_code -> value object. Tenant override wins.
    const merged = new Map();

    // Sort: System first, then Tenant (so Tenant overwrites System in Map)
    // Actually, rawValues order isn't guaranteed.
    // Let's iterate.

    rawValues?.forEach(rv => {
        const existing = merged.get(rv.internal_code);
        // If no existing, or if current is TENANT specific (so it overrides system), set it.
        // If existing is tenant specific and current is system, do NOT overwrite.
        if (!existing || (rv.tenant_id === tenantId)) {

            // Resolve Label (Hebrew preference)
            const label = rv.label_i18n?.['he'] || rv.label_i18n?.['en'] || rv.internal_code;

            merged.set(rv.internal_code, {
                value: rv.internal_code,
                label: label,
                color: rv.color,
                icon: rv.icon,
                is_system: !rv.tenant_id,
                is_custom: !!rv.tenant_id,
                payload: rv // Keep full object for UI (hebrew label etc)
            });
        }
    });

    const results = Array.from(merged.values())
        .sort((a, b) => (a.payload.sort_order || 0) - (b.payload.sort_order || 0));

    return NextResponse.json({ data: results });
}
