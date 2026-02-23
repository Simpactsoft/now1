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
            <div className="flex flex-col h-screen items-center justify-center bg-muted/30 text-foreground p-6">
                <div className="bg-card p-8 rounded-2xl shadow-sm border border-border text-center max-w-md w-full">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Quote Unavailable</h1>
                    <p className="text-muted-foreground">{result.error || "The quote link is invalid, expired, or has been revoked."}</p>
                </div>
            </div>
        );
    }

    if (!result.data) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-muted/30 text-foreground p-6">
                <div className="bg-card p-8 rounded-2xl shadow-sm border border-border text-center max-w-md w-full">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Quote Unavailable</h1>
                    <p className="text-muted-foreground">The quote data could not be loaded.</p>
                </div>
            </div>
        );
    }

    const isRtl = result.data.tenant?.rtl_enabled ?? false;

    return (
        <div className="min-h-screen bg-muted/30" dir={isRtl ? "rtl" : "ltr"}>
            <PublicQuoteViewer quote={result.data} token={token} clientIp={clientIp} />
        </div>
    );
}
