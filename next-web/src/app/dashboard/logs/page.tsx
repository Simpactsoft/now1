"use client";

import { useEffect, useState } from "react";
import { fetchAuditLogs } from "@/app/actions/fetchAuditLogs";
import { Loader2, User, Clock, FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Types based on DB Schema
type AuditLog = {
    id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    table_name: string;
    record_id: string;
    old_values: any;
    new_values: any;
    changed_fields: string[] | null;
    created_at: string;
    performed_by: string;
    actor?: {
        first_name: string;
        last_name: string;
        email: string;
    }
};

export default function LogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);

    // 1. Get Tenant ID (Client-side simplified)
    useEffect(() => {
        // In a real app, use a Context or helper. 
        // For now, grabbing from cookie or assuming context.
        // We'll trust the server action to validate if we pass simple ID, 
        // but typically better to get confirmed ID.
        // Let's use a reliable method or hardcode for dev if needed, 
        // but preferrably get from document.cookie logic or prop.
        // Workaround: We'll force fetch via a wrapper that gets tenant on server?
        // No, let's just use the server component pattern or standard fetch.
        // Actually, let's assume we can get it or the server action infers it from session?
        // The server action 'fetchAuditLogs' asks for tenantId argument currently.
        // Let's fetch the user/tenant first.

        // Fast Hack: Inspect URL or Cookie?
        // Better: Use a Server Client pattern inside the component? 
        // Wait, "use client" components can't easily get headers.
        // Let's rely on standard pattern (assuming parent passes it or we fetch self).
        const fetchSelf = async () => {
            // We can't easily import 'createClient' here properly without setup.
            // Let's assume for this specific view we can parse cookie 'tenant_id'.
            const match = document.cookie.match(new RegExp('(^| )tenant_id=([^;]+)'));
            if (match) {
                setTenantId(match[2].replace(/['"]+/g, ''));
            }
        }
        fetchSelf();
    }, []);

    useEffect(() => {
        if (!tenantId) return;

        fetchAuditLogs(tenantId)
            .then(res => {
                if (res.success && res.data) setLogs(res.data.data as AuditLog[]);
            })
            .finally(() => setLoading(false));
    }, [tenantId]);

    if (!tenantId) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>;

    const getOpColor = (op: string) => {
        switch (op) {
            case 'INSERT': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'UPDATE': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'DELETE': return 'text-red-400 bg-red-400/10 border-red-400/20';
            default: return 'text-zinc-400';
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
            <header className="flex flex-col gap-1 pb-6 border-b border-white/10">
                <h1 className="text-3xl font-bold tracking-tight text-white/90">Activity Logs</h1>
                <p className="text-zinc-500 text-sm">Real-time audit trail of all platform activities.</p>
            </header>

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin w-8 h-8 text-brand-primary" /></div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] glass rounded-3xl border border-dashed border-white/10">
                    <p className="text-zinc-500 italic">No logs recorded yet.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {logs.map(log => (
                        <div key={log.id} className="glass p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center hover:bg-white/5 transition-colors">
                            {/* Icon / Operation */}
                            <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${getOpColor(log.operation)}`}>
                                {log.operation}
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-zinc-200 text-sm">
                                        {log.table_name.toUpperCase()} <span className="text-zinc-500 font-normal">#{log.record_id.slice(0, 8)}</span>
                                    </h3>
                                    <span className="text-zinc-600 text-xs">•</span>
                                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                                        <Clock size={10} />
                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-400">
                                    {log.changed_fields ? (
                                        <span className="flex items-center gap-1">
                                            Changed fields: <span className="text-blue-300 bg-blue-500/10 px-1.5 rounded">{log.changed_fields.join(', ')}</span>
                                        </span>
                                    ) : (
                                        <span>Full Record {log.operation === 'INSERT' ? 'Created' : 'Removed'}</span>
                                    )}
                                </div>
                            </div>

                            {/* Actor */}
                            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-black/20 px-3 py-2 rounded-lg border border-white/5">
                                <User size={14} className="text-zinc-400" />
                                <span>{log.actor?.email || 'System'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
