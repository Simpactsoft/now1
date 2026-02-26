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
            created_at,
            organizations_ext (
                tax_id,
                company_size,
                industry
            )
        `)
        .eq("id", id)
        .eq("tenant_id", auth.tenantId)
        .eq("type", "organization")
        .single();

    if (error || !data) return errorResponse("Organization not found.", "NOT_FOUND", 404);

    const ext = (data.organizations_ext as any)?.[0] ?? {};
    const emails = (data.contact_methods as any[])?.filter((c: any) => c.type === "email") ?? [];
    const phones = (data.contact_methods as any[])?.filter((c: any) => c.type === "phone") ?? [];

    return NextResponse.json({
        data: {
            id: data.id,
            name: data.display_name,
            status: data.status,
            email: emails[0]?.value ?? null,
            phone: phones[0]?.value ?? null,
            industry: ext.industry ?? null,
            company_size: ext.company_size ?? null,
            tax_id: ext.tax_id ?? null,
            tags: data.tags,
            custom_fields: data.custom_fields,
            created_at: data.created_at,
        },
    });
}
