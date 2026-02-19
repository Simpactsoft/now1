'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import {
    getPendingApprovals,
    approveMarginException,
    rejectMarginException,
} from '@/app/actions/profitability-actions';

// ============================================================================
// TYPES
// ============================================================================

interface PendingApproval {
    id: string;
    quoteId: string;
    marginPct: number;
    minRequired: number;
    requestedBy: string | null;
    requestedAt: string;
    notes: string | null;
    // Joined fields (from quotes table, fetched client-side)
    quoteNumber?: string;
    customerName?: string;
    totalAmount?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ApprovalQueue({ tenantId }: { tenantId: string }) {
    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchApprovals = useCallback(async () => {
        setLoading(true);
        const result = await getPendingApprovals(tenantId);
        if (result.success && result.data) {
            setApprovals(result.data.map(a => ({
                id: a.id,
                quoteId: a.quoteId,
                marginPct: a.marginPct,
                minRequired: a.minRequired,
                requestedBy: a.requestedBy,
                requestedAt: a.requestedAt,
                notes: a.notes,
            })));
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

    const handleApprove = async (quoteId: string) => {
        setProcessingId(quoteId);
        const result = await approveMarginException(quoteId, 'Approved via Approval Queue');
        if (result.success) {
            setApprovals(prev => prev.filter(a => a.quoteId !== quoteId));
        }
        setProcessingId(null);
    };

    const handleReject = async (quoteId: string) => {
        const notes = prompt('Rejection reason (optional):');
        setProcessingId(quoteId);
        const result = await rejectMarginException(quoteId, notes || 'Rejected via Approval Queue');
        if (result.success) {
            setApprovals(prev => prev.filter(a => a.quoteId !== quoteId));
        }
        setProcessingId(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Margin Approvals</h1>
                    <p className="text-sm text-muted-foreground">
                        Quotes below minimum margin threshold requiring manager approval
                    </p>
                </div>
                <span className="ms-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 text-amber-700">
                    {approvals.length} pending
                </span>
            </div>

            {/* Queue */}
            {approvals.length === 0 ? (
                <div className="text-center py-16 border border-border rounded-2xl bg-card">
                    <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-60" />
                    <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
                    <p className="text-sm text-muted-foreground mt-1">No quotes pending approval</p>
                </div>
            ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Quote</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Margin %</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Min Required</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Requested</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Notes</th>
                                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {approvals.map((approval) => (
                                <tr key={approval.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-mono text-xs">{approval.quoteId.slice(0, 8)}...</div>
                                    </td>
                                    <td className="px-4 py-3 text-end">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700">
                                            <AlertTriangle className="w-3 h-3" />
                                            {approval.marginPct.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-end font-mono text-xs text-muted-foreground">
                                        {approval.minRequired.toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {new Date(approval.requestedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                                        {approval.notes || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleApprove(approval.quoteId)}
                                                disabled={processingId === approval.quoteId}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                            >
                                                {processingId === approval.quoteId ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-3 h-3" />
                                                )}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(approval.quoteId)}
                                                disabled={processingId === approval.quoteId}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                            >
                                                <XCircle className="w-3 h-3" />
                                                Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
