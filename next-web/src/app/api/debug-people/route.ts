
import { fetchPeople } from "@/app/actions/fetchPeople";
import { NextResponse } from "next/server";

export async function GET() {
    // Simulate what the Grid sends
    const params = {
        tenantId: "00000000-0000-0000-0000-000000000002", // The ID we saw in screenshot
        startRow: 0,
        endRow: 10,
        sortModel: [],
        filterModel: {}
    };

    const result = await fetchPeople(params as any);

    return NextResponse.json({
        debug_check: "Checking if RET_NAME is present",
        rowCount: result.rowCount,
        first_10_rows: result.rowData
    });
}
