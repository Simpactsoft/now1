import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getAdminClient, errorResponse } from "../_utils";

/**
 * GET /api/v1/schema
 *
 * Returns the custom field definitions for this tenant.
 * External apps use this to know what custom_fields keys are valid.
 */
export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = getAdminClient();

    // Fetch custom field definitions for this tenant
    const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("id, field_key, label, field_type, entity_type, is_required, default_value, options, created_at")
        .eq("tenant_id", auth.tenantId)
        .order("entity_type", { ascending: true })
        .order("label", { ascending: true });

    if (error) {
        // Table might not exist yet – return empty schema gracefully
        console.warn("[API/v1/schema] custom_field_definitions query failed:", error.message);
        return NextResponse.json({
            data: {
                organizations: [],
                people: [],
                relationships: [],
            },
            meta: { note: "No custom fields defined yet." },
        });
    }

    // Group by entity_type for easier consumption
    const grouped: Record<string, any[]> = {
        organizations: [],
        people: [],
        relationships: [],
    };

    for (const field of (data ?? [])) {
        const key = field.entity_type ?? "other";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
            key: field.field_key,
            label: field.label,
            type: field.field_type,        // "text" | "number" | "boolean" | "date" | "select"
            required: field.is_required ?? false,
            default: field.default_value ?? null,
            options: field.options ?? null, // For "select" type: ["Option A", "Option B"]
        });
    }

    return NextResponse.json({ data: grouped });
}
