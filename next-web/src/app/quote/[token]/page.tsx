import React from "react";
import { getPublicQuote } from "@/app/actions/publicQuote";
import PublicQuoteViewer from "@/components/sales/PublicQuoteViewer";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    // Pass client IP to the viewer for recording the digital signature
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0] : realIp) || 'unknown';

    const result = await getPublicQuote(token);

    if (!result.success) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-800 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Unavailable</h1>
                    <p className="text-slate-500">{result.error || "The quote link is invalid, expired, or has been revoked."}</p>
                </div>
            </div>
        );
    }

    if (!result.data) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-800 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Unavailable</h1>
                    <p className="text-slate-500">The quote data could not be loaded.</p>
                </div>
            </div>
        );
    }

    const isRtl = result.data.tenant?.rtl_enabled ?? false;

    return (
        <div className="min-h-screen bg-slate-50" dir={isRtl ? "rtl" : "ltr"}>
            <PublicQuoteViewer quote={result.data} token={token} clientIp={clientIp} />
        </div>
    );
}
