"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useCallback } from "react";
import {
    FileText,
    Loader2,
    Send,
    XCircle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    DollarSign,
} from "lucide-react";
import {
    getInvoices,
    getInvoiceItems,
    issueInvoice,
    cancelInvoice,
    markInvoicePaid,
} from "@/app/actions/invoice-actions";

// ============================================================================
// TYPES
// ============================================================================

interface Invoice {
    id: string;
    invoiceNumber: string | null;
    orderId: string | null;
    customerName: string | null;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    currency: string;
    notes: string | null;
    createdAt: string;
}

interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InvoiceDashboard({ tenantId }: { tenantId: string }) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("");

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        const result = await getInvoices(tenantId, filterStatus || undefined);
        if (result.success && result.data) {
            setInvoices(result.data);
        }
        setLoading(false);
    }, [tenantId, filterStatus]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const handleExpand = async (invoiceId: string) => {
        if (expandedId === invoiceId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(invoiceId);
        setItemsLoading(true);
        const result = await getInvoiceItems(tenantId, invoiceId);
        if (result.success && result.data) {
            setItems(result.data);
        }
        setItemsLoading(false);
    };

    const handleIssue = async (invoiceId: string) => {
        if (!confirm("Issue this invoice? This will create accounting entries and cannot be easily undone.")) return;
        setProcessingId(invoiceId);
        const result = await issueInvoice(tenantId, invoiceId);
        if (result.success) {
            fetchInvoices();
        } else {
            if (result.error?.includes("Missing GL account") || result.error?.includes("Required account type")) {
                toast.error("Cannot issue invoice: required accounting accounts are not set up. Go to Accounting → Chart of Accounts to seed accounts.");
            } else {
                toast.error(`Failed: ${result.error}`);
            }
        }
        setProcessingId(null);
    };

    const handleCancel = async (invoiceId: string) => {
        const reason = prompt("Reason for cancellation (optional):");
        if (reason === null) return; // user pressed Cancel
        setProcessingId(invoiceId);
        const result = await cancelInvoice(tenantId, invoiceId, reason || undefined);
        if (result.success) {
            fetchInvoices();
        } else {
            toast.error(`Failed: ${result.error}`);
        }
        setProcessingId(null);
    };

    const handleMarkPaid = async (invoiceId: string) => {
        setProcessingId(invoiceId);
        const result = await markInvoicePaid(tenantId, invoiceId);
        if (result.success) {
            fetchInvoices();
        } else {
            toast.error(`Failed: ${result.error}`);
        }
        setProcessingId(null);
    };

    const statusColors: Record<string, string> = {
        draft: 'bg-slate-500/10 text-slate-600',
        issued: 'bg-blue-500/10 text-blue-600',
        paid: 'bg-emerald-500/10 text-emerald-600',
        cancelled: 'bg-red-500/10 text-red-600',
        void: 'bg-gray-500/10 text-gray-600',
    };

    const fmt = (n: number, curr: string) => {
        const symbol = curr === 'ILS' ? '₪' : curr === 'USD' ? '$' : curr;
        return `${symbol} ${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
                <p className="text-sm text-muted-foreground">Manage invoices and billing</p>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-border flex items-center gap-4">
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <span className="text-xs text-muted-foreground">{invoices.length} invoice(s)</span>
            </div>

            {/* Invoice List */}
            <div className="flex-1 overflow-auto p-6">
                {invoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p>No invoices found</p>
                        <p className="text-xs mt-1">Generate invoices from approved quotes</p>
                    </div>
                ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="w-8 px-2"></th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Invoice #</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Due</th>
                                    <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {invoices.map(inv => (
                                    <React.Fragment key={inv.id}>
                                        <tr
                                            className="hover:bg-muted/20 cursor-pointer"
                                            onClick={() => handleExpand(inv.id)}
                                        >
                                            <td className="px-2 text-center">
                                                {expandedId === inv.id
                                                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                }
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber || '—'}</td>
                                            <td className="px-4 py-3">{inv.customerName || '—'}</td>
                                            <td className="px-4 py-3 text-xs">{inv.issueDate || '—'}</td>
                                            <td className="px-4 py-3 text-xs">{inv.dueDate || '—'}</td>
                                            <td className="px-4 py-3 text-end font-mono font-medium">{fmt(inv.totalAmount, inv.currency)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || ''}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    {inv.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleIssue(inv.id)}
                                                            disabled={processingId === inv.id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                                            title="Issue invoice"
                                                        >
                                                            {processingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                                            Issue
                                                        </button>
                                                    )}
                                                    {inv.status === 'issued' && (
                                                        <button
                                                            onClick={() => handleMarkPaid(inv.id)}
                                                            disabled={processingId === inv.id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                                            title="Mark as paid"
                                                        >
                                                            {processingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                                            Paid
                                                        </button>
                                                    )}
                                                    {(inv.status === 'draft' || inv.status === 'issued') && (
                                                        <button
                                                            onClick={() => handleCancel(inv.id)}
                                                            disabled={processingId === inv.id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                                            title="Cancel invoice"
                                                        >
                                                            <XCircle className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    {inv.status === 'paid' && (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {expandedId === inv.id && (
                                            <tr>
                                                <td colSpan={8} className="bg-muted/30 px-8 py-4">
                                                    {itemsLoading ? (
                                                        <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                                    ) : items.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-2">No line items</p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-muted-foreground">
                                                                        <th className="text-start pb-1">Description</th>
                                                                        <th className="text-end pb-1">Qty</th>
                                                                        <th className="text-end pb-1">Unit Price</th>
                                                                        <th className="text-end pb-1">Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border/50">
                                                                    {items.map(item => (
                                                                        <tr key={item.id}>
                                                                            <td className="py-1">{item.description}</td>
                                                                            <td className="py-1 text-end font-mono">{item.quantity}</td>
                                                                            <td className="py-1 text-end font-mono">{fmt(item.unitPrice, inv.currency)}</td>
                                                                            <td className="py-1 text-end font-mono font-medium">{fmt(item.lineTotal, inv.currency)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            <div className="border-t border-border pt-2 flex justify-end gap-6 text-xs">
                                                                <span className="text-muted-foreground">Subtotal: <span className="font-mono font-medium text-foreground">{fmt(inv.subtotal, inv.currency)}</span></span>
                                                                <span className="text-muted-foreground">VAT ({(inv.vatRate * 100).toFixed(0)}%): <span className="font-mono font-medium text-foreground">{fmt(inv.vatAmount, inv.currency)}</span></span>
                                                                <span className="font-semibold">Total: <span className="font-mono">{fmt(inv.totalAmount, inv.currency)}</span></span>
                                                            </div>
                                                            {inv.notes && (
                                                                <p className="text-xs text-muted-foreground italic">Note: {inv.notes}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
