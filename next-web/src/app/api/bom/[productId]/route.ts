import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface BomTreeNode {
    id: string;
    bom_header_id: string;
    parent_item_id: string | null;
    component_product_id: string;
    level: number;
    sequence: number;
    quantity: number;
    total_quantity: number;
    unit: string;
    scrap_factor: number;
    is_assembly: boolean;
    is_phantom: boolean;
    sku: string;
    name: string;
    cost_price: number;
    list_price: number;
    extended_cost: number;
    extended_price: number;
    path: string[];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { productId } = await params;
        const supabase = await createClient();

        // Get tenant ID from cookies
        const cookieStore = await cookies();
        const tenantId = cookieStore.get("tenant_id")?.value;

        if (!tenantId) {
            return NextResponse.json(
                { error: "Tenant ID not found" },
                { status: 400 }
            );
        }

        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get version from query params (default to latest active version)
        const searchParams = request.nextUrl.searchParams;
        const version = searchParams.get("version") || "1.0";

        console.log("[BOM API] Looking for BOM header:", { productId, version, tenantId });

        // First get the BOM header ID
        const { data: bomHeader, error: headerError } = await supabase
            .from("bom_headers")
            .select("id")
            .eq("product_id", productId)
            .eq("version", version)
            .eq("status", "ACTIVE")
            .single();

        console.log("[BOM API] BOM header result:", { bomHeader, headerError });

        if (headerError || !bomHeader) {
            // Try to find ANY BOM headers for this product (without RLS)
            const { data: anyHeaders, error: anyError } = await supabase
                .from("bom_headers")
                .select("id, product_id, version, status, tenant_id")
                .eq("product_id", productId);

            console.log("[BOM API] All BOM headers for product:", { anyHeaders, anyError });

            return NextResponse.json({
                ok: true,
                data: {
                    tree: [],
                    totalCost: 0,
                    productId,
                    version,
                    bomHeaderId: null
                }
            });
        }

        // Call the get_bom_tree function
        const { data: bomTree, error } = await supabase
            .rpc("get_bom_tree", {
                p_product_id: productId,
                p_version: version
            });

        if (error) {
            console.error("[BOM API] Error fetching BOM tree:", error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        // Calculate total cost
        const { data: totalCost, error: costError } = await supabase
            .rpc("calculate_bom_cost", {
                p_product_id: productId,
                p_version: version
            });

        if (costError) {
            console.error("[BOM API] Error calculating BOM cost:", costError);
        }

        return NextResponse.json({
            ok: true,
            data: {
                tree: bomTree || [],
                totalCost: totalCost || 0,
                productId,
                version,
                bomHeaderId: bomHeader.id
            }
        });

    } catch (error: any) {
        console.error("[BOM API] Unexpected error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
