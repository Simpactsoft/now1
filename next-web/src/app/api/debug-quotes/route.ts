import { fetchQuotesByCustomer } from "@/app/actions/fetchQuotesByCustomer";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000003';
    const customerId = searchParams.get('customerId') || '1295b662-fa20-40fd-abbb-3cd913f66af1';

    try {
        const res = await fetchQuotesByCustomer(tenantId, customerId);
        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
