"use client";

import { useLanguage } from "@/context/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { Building2, Users, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useGridPersistence } from "@/hooks/useGridPersistence"; // [NEW] Grid Persistence
import { useEffect } from "react";

interface Tenant {
    id: string;
    name: string;
    slug: string;
    type?: string;
    created_at?: string;
    user_count?: number;
    status?: string;
    billing_status?: string;
}

export default function TenantsGrid({ tenants }: { tenants: Tenant[] }) {
    const { language } = useLanguage();
    const { saveState, restoredState, restoreScroll } = useGridPersistence('tenants-grid'); // Key for session storage

    // Restore scroll position when data loads and state exists
    useEffect(() => {
        if (restoredState?.rowId && tenants.length > 0) {
            restoreScroll(restoredState.rowId);
        }
    }, [restoredState, tenants, restoreScroll]);

    if (!tenants || tenants.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center justify-center text-center opacity-50 border border-white/5 bg-[#1C1C1E]/50 rounded-2xl">
                <Building2 className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-zinc-500">No workspaces found.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E]/80 backdrop-blur-xl">
            <table className="w-full text-left">
                <thead className="border-b border-white/10 bg-white/5">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Workspace</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Users</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Billing</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Created</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {tenants.map(tenant => {
                        const status = tenant.status || 'active';
                        const billing = tenant.billing_status || 'free';
                        // Use restoredState ID to conditionally highlight (optional, but hook handles auto-scroll)

                        return (
                            <tr
                                key={tenant.id}
                                id={tenant.id} // Required for scrollIntoView
                                className="group hover:bg-white/5 transition-colors cursor-pointer active:bg-indigo-500/10"
                                onClick={() => {
                                    saveState({ rowId: tenant.id });
                                    window.location.href = `/dashboard/admin/${tenant.id}`;
                                }}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-indigo-500/20 text-indigo-400 transition-colors">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white group-hover:text-indigo-200 transition-colors">
                                                {tenant.name}
                                            </div>
                                            <div className="text-xs text-zinc-500 font-mono">
                                                {tenant.slug}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <StatusBadge status={status} />
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                                        <Users className="w-4 h-4 text-zinc-500" />
                                        <span>{tenant.user_count || 0}</span>
                                    </div>
                                </td>

                                <td className="px-6 py-4">
                                    <BillingBadge status={billing} />
                                </td>

                                <td className="px-6 py-4 text-right">
                                    <div className="text-xs text-zinc-500">
                                        {tenant.created_at ? formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true }) : '-'}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        active: "bg-green-500/10 text-green-400 border-green-500/20",
        frozen: "bg-red-500/10 text-red-400 border-red-500/20",
        inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    };

    const style = styles[status as keyof typeof styles] || styles.inactive;

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style}`}>
            {status}
        </span>
    );
}

function BillingBadge({ status }: { status: string }) {
    const styles = {
        pro: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        enterprise: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    };

    const style = styles[status as keyof typeof styles] || styles.free;

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style}`}>
            {status}
        </span>
    );
}
