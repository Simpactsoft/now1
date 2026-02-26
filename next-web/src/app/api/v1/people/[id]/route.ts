import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getAdminClient, errorResponse } from "../../_utils";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await validateApiKey(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from("cards")
        .select(`
            id,
            display_name,
            status,
            custom_fields,
            tags,
            contact_methods,
            created_at
        `)
        .eq("id", id)
        .eq("tenant_id", auth.tenantId)
        .eq("type", "person")
        .single();

    if (error || !data) return errorResponse("Person not found.", "NOT_FOUND", 404);

    const contacts = data.contact_methods as any[] ?? [];
    const email = contacts.find((c: any) => c.type === "email")?.value ?? null;
    const phone = contacts.find((c: any) => c.type === "phone")?.value ?? null;
    const nameParts = (data.display_name ?? "").split(" ");

    return NextResponse.json({
        data: {
            id: data.id,
            first_name: nameParts[0] ?? "",
            last_name: nameParts.slice(1).join(" ") ?? "",
            name: data.display_name,
            status: data.status,
            email,
            phone,
            tags: data.tags,
            custom_fields: data.custom_fields,
            created_at: data.created_at,
        },
    });
}
