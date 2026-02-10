import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Generic Tree Data API Endpoint
 * 
 * Supports lazy-loading hierarchical data for:
 * - BOM (Bill of Materials)
 * - WBS (Work Breakdown Structure)
 * - Categories
 * - Organization Charts
 * 
 * Query Parameters:
 * - entity: 'bom' | 'wbs' | 'category' (required)
 * - headerId: UUID of root entity (required for BOM)
 * - parentId: UUID of parent node (null = root level)
 * - limit: number of items to return (default: 100)
 * - offset: pagination offset (default: 0)
 * - sort: sort field (default: 'sequence')
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const searchParams = request.nextUrl.searchParams;

        // Get tenant ID from cookies
        const cookieStore = await cookies();
        const tenantId = cookieStore.get("tenant_id")?.value;

        if (!tenantId) {
            return NextResponse.json(
                { error: "Tenant ID not found" },
                { status: 400 }
            );
        }

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Parse query parameters
        const entity = searchParams.get("entity");
        const headerId = searchParams.get("headerId");
        const parentIdRaw = searchParams.get("parentId");
        // Convert string "null" to actual null
        const parentId = parentIdRaw === "null" || parentIdRaw === "" ? null : parentIdRaw;
        const limit = parseInt(searchParams.get("limit") || "100");
        const offset = parseInt(searchParams.get("offset") || "0");

        // Validate required parameters
        if (!entity) {
            return NextResponse.json(
                { error: "Missing required parameter: entity" },
                { status: 400 }
            );
        }

        // Route to appropriate handler based on entity type
        switch (entity) {
            case "bom":
                return await handleBomTree(supabase, headerId, parentId, limit, offset);

            // Future support for other entity types
            case "wbs":
                return NextResponse.json(
                    { error: "WBS not yet implemented" },
                    { status: 501 }
                );

            case "category":
                return NextResponse.json(
                    { error: "Category trees not yet implemented" },
                    { status: 501 }
                );

            default:
                return NextResponse.json(
                    { error: `Unknown entity type: ${entity}` },
                    { status: 400 }
                );
        }

    } catch (error: any) {
        console.error("[Tree API] Unexpected error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * Handle BOM tree data requests
 */
async function handleBomTree(
    supabase: any,
    headerId: string | null,
    parentId: string | null,
    limit: number,
    offset: number
) {
    if (!headerId) {
        return NextResponse.json(
            { error: "Missing required parameter: headerId for BOM" },
            { status: 400 }
        );
    }

    // Call the lazy-loading function
    console.log("[Tree API] Calling get_tree_children with params:", {
        p_bom_header_id: headerId,
        p_parent_item_id: parentId,
        p_limit: limit,
        p_offset: offset
    });

    const { data, error } = await supabase.rpc("get_tree_children", {
        p_bom_header_id: headerId,
        p_parent_item_id: parentId,
        p_limit: limit,
        p_offset: offset
    });

    console.log("[Tree API] RPC result:", { data, error, dataLength: data?.length });

    if (error) {
        console.error("[Tree API] Error fetching BOM children:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }

    // Count total children at this level (for pagination)
    const totalCount = data?.length || 0;
    const hasMore = totalCount === limit; // If we got a full page, there might be more

    return NextResponse.json({
        ok: true,
        data: {
            rows: data || [],
            totalCount,
            hasMore,
            parentId,
            limit,
            offset
        }
    });
}
