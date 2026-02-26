import { Suspense } from "react";
import RelationshipsGlobalWrapper from "@/components/relationships/RelationshipsGlobalWrapper";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function RelationshipsPage() {
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const currentTenantId = rawTenantId?.replace(/['"]+/g, '');

    if (!currentTenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5 p-8 text-center max-w-md mx-auto mt-20">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Select a Workspace</h2>
                <p className="text-zinc-400 text-sm leading-relaxed text-balance">
                    Please select a tenant from the sidebar to view relationships.
                </p>
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="flex flex-col h-full w-full items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading relationships...</p>
            </div>
        }>
            <RelationshipsGlobalWrapper tenantId={currentTenantId} />
        </Suspense>
    );
}
