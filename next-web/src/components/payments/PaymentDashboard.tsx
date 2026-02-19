"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Loader2,
    Plus,
    DollarSign,
    CreditCard,
    XCircle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Ban,
    Search,
} from "lucide-react";
import {
    getPayments,
    getPayment,
    createPayment,
    addPaymentAllocation,
    removePaymentAllocation,
    postPayment,
    voidPayment,
    getEntityOutstandingDocuments,
} from "@/app/actions/payment-actions";
import { getVendors } from "@/app/actions/purchase-order-actions";

// ============================================================================
// TYPES
// ============================================================================

interface Payment {
    id: string;
    payment_number: string;
    payment_type: string;
    entity_type: string;
    entity_id: string;
    payment_date: string;
    payment_method: string;
    amount: number;
    currency: string;
    reference: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    payment_allocations: Allocation[];
}

interface Allocation {
    id: string;
    invoice_id: string | null;
    po_id: string | null;
    amount: number;
}

interface OutstandingDoc {
    id: string;
    invoice_number?: string;
    po_number?: string;
    total_amount?: number;
    total?: number;
    balance_due?: number;
    status: string;
    issue_date?: string;
    order_date?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PaymentDashboard({ tenantId }: { tenantId: string }) {
    const [activeTab, setActiveTab] = useState<"customer" | "vendor">("customer");

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Payments</h1>
                <p className="text-sm text-muted-foreground">Track customer receipts and vendor payments</p>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-border flex gap-0">
                {([
                    { key: "customer" as const, label: "Customer Receipts" },
                    { key: "vendor" as const, label: "Vendor Payments" },
                ]).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <PaymentTab
                key={activeTab}
                tenantId={tenantId}
                paymentType={activeTab === "customer" ? "customer_receipt" : "vendor_payment"}
                entityType={activeTab}
            />
        </div>
    );
}

// ============================================================================
// PAYMENT TAB
// ============================================================================

function PaymentTab({
    tenantId,
    paymentType,
    entityType,
}: {
    tenantId: string;
    paymentType: string;
    entityType: "customer" | "vendor";
}) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<Payment | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [filterStatus, setFilterStatus] = useState("");

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        const result = await getPayments(tenantId, paymentType, filterStatus || undefined);
        if (result.success && result.data) {
            setPayments(result.data as Payment[]);
        }
        setLoading(false);
    }, [tenantId, paymentType, filterStatus]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    const handleExpand = async (id: string) => {
        if (expandedId === id) { setExpandedId(null); return; }
        setExpandedId(id);
        setDetailLoading(true);
        const result = await getPayment(tenantId, id);
        if (result.success && result.data) setDetail(result.data as Payment);
        setDetailLoading(false);
    };

    const handlePost = async (id: string) => {
        if (!confirm("Post this payment? This will create accounting entries.")) return;
        setProcessingId(id);
        const result = await postPayment(tenantId, id);
        if (result.success) {
            fetchPayments();
        } else {
            if (result.error?.includes("Missing GL account")) {
                alert("Cannot post payment: required accounting accounts are not set up. Go to Accounting → Chart of Accounts to seed accounts.");
            } else {
                alert(result.error);
            }
        }
        setProcessingId(null);
    };

    const handleVoid = async (id: string) => {
        if (!confirm("Void this payment? This will create a reversing journal entry.")) return;
        setProcessingId(id);
        const result = await voidPayment(tenantId, id);
        if (result.success) fetchPayments(); else alert(result.error);
        setProcessingId(null);
    };

    const statusColors: Record<string, string> = {
        draft: "bg-slate-500/10 text-slate-600",
        posted: "bg-emerald-500/10 text-emerald-600",
        void: "bg-red-500/10 text-red-600",
    };

    const methodLabels: Record<string, string> = {
        cash: "Cash",
        bank_transfer: "Bank Transfer",
        check: "Check",
        credit_card: "Credit Card",
        other: "Other",
    };

    const fmt = (n: number, curr: string) => {
        const symbol = curr === "ILS" ? "₪" : curr === "USD" ? "$" : curr;
        return `${symbol} ${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                    >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="posted">Posted</option>
                        <option value="void">Void</option>
                    </select>
                    <span className="text-xs text-muted-foreground">{payments.length} payment(s)</span>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5"
                >
                    <Plus size={14} /> New {entityType === "customer" ? "Receipt" : "Payment"}
                </button>
            </div>

            {/* Payment List */}
            {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <DollarSign size={40} className="mb-2 opacity-50" />
                    <p>No {entityType === "customer" ? "receipts" : "payments"} found</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {payments.map((pay) => (
                        <div key={pay.id}>
                            <div
                                className="px-6 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                                onClick={() => handleExpand(pay.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {expandedId === pay.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span className="font-mono text-sm font-medium text-foreground">{pay.payment_number}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${statusColors[pay.status] || ""}`}>
                                            {pay.status}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{methodLabels[pay.payment_method] || pay.payment_method}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-muted-foreground">{pay.payment_date}</span>
                                        <span className="text-sm font-medium tabular-nums">{fmt(pay.amount, pay.currency)}</span>
                                    </div>
                                </div>
                                {pay.reference && (
                                    <div className="text-xs text-muted-foreground mt-0.5 ml-7">Ref: {pay.reference}</div>
                                )}
                            </div>

                            {/* Expanded Detail */}
                            {expandedId === pay.id && (
                                <div className="px-6 pb-4 bg-secondary/10">
                                    {detailLoading ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                    ) : detail && detail.id === pay.id ? (
                                        <div>
                                            {/* Allocations */}
                                            <div className="mt-2">
                                                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Allocations</h4>
                                                {detail.payment_allocations.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic">No allocations yet</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {detail.payment_allocations.map((alloc) => (
                                                            <div key={alloc.id} className="flex items-center justify-between text-sm py-1">
                                                                <span className="text-muted-foreground">
                                                                    {alloc.invoice_id ? `Invoice` : `PO`}
                                                                </span>
                                                                <span className="font-medium tabular-nums">{fmt(alloc.amount, pay.currency)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            {pay.notes && (
                                                <div className="mt-3 text-sm text-muted-foreground">
                                                    <span className="font-medium">Notes:</span> {pay.notes}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="mt-4 flex items-center gap-2">
                                                {pay.status === "draft" && (
                                                    <button
                                                        onClick={() => handlePost(pay.id)}
                                                        disabled={processingId === pay.id}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        {processingId === pay.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                        Post Payment
                                                    </button>
                                                )}
                                                {pay.status === "posted" && (
                                                    <button
                                                        onClick={() => handleVoid(pay.id)}
                                                        disabled={processingId === pay.id}
                                                        className="px-3 py-1.5 bg-red-600/10 text-red-600 rounded-lg text-xs font-medium hover:bg-red-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        {processingId === pay.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                                                        Void
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Payment Dialog */}
            {showCreate && (
                <CreatePaymentDialog
                    tenantId={tenantId}
                    paymentType={paymentType}
                    entityType={entityType}
                    onCreated={() => { setShowCreate(false); fetchPayments(); }}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}

// ============================================================================
// CREATE PAYMENT DIALOG
// ============================================================================

interface EntityOption {
    id: string;
    name: string;
}

function CreatePaymentDialog({
    tenantId,
    paymentType,
    entityType,
    onCreated,
    onClose,
}: {
    tenantId: string;
    paymentType: string;
    entityType: "customer" | "vendor";
    onCreated: () => void;
    onClose: () => void;
}) {
    const [entities, setEntities] = useState<EntityOption[]>([]);
    const [entityId, setEntityId] = useState("");
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState("bank_transfer");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    // Outstanding documents for allocation
    const [docs, setDocs] = useState<OutstandingDoc[]>([]);
    const [allocations, setAllocations] = useState<Record<string, number>>({});

    useEffect(() => {
        if (entityType === "vendor") {
            getVendors(tenantId).then((r) => {
                if (r.success && r.data) {
                    setEntities((r.data as Array<{ id: string; name: string }>).map((v) => ({ id: v.id, name: v.name })));
                }
            });
        } else {
            // Fetch customers (contacts/cards)
            import("@/lib/supabase/admin").then(({ createAdminClient }) => {
                const admin = createAdminClient();
                admin
                    .from("cards")
                    .select("id, display_name")
                    .eq("tenant_id", tenantId)
                    .eq("card_type", "person")
                    .order("display_name")
                    .then(({ data }) => {
                        if (data) setEntities(data.map((c: { id: string; display_name: string }) => ({ id: c.id, name: c.display_name || "Unknown" })));
                    });
            });
        }
    }, [tenantId, entityType]);

    // Fetch outstanding docs when entity changes
    useEffect(() => {
        if (!entityId) { setDocs([]); return; }
        getEntityOutstandingDocuments(tenantId, entityType, entityId).then((r) => {
            if (r.success && r.data) setDocs(r.data as OutstandingDoc[]);
        });
    }, [tenantId, entityType, entityId]);

    const allocatedTotal = Object.values(allocations).reduce((s, v) => s + v, 0);

    const fmt = (n: number) => `₪ ${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleCreate = async () => {
        if (!entityId) { alert("Please select a " + entityType); return; }
        if (amount <= 0) { alert("Amount must be positive"); return; }
        setSaving(true);

        // Create payment
        const result = await createPayment(tenantId, {
            paymentType: paymentType as "customer_receipt" | "vendor_payment",
            entityType,
            entityId,
            paymentDate: date,
            paymentMethod: method as "cash" | "bank_transfer" | "check" | "credit_card" | "other",
            amount,
            reference: reference || null,
            notes: notes || null,
        });

        if (!result.success) { alert(result.error); setSaving(false); return; }

        // Add allocations
        for (const [docId, allocAmount] of Object.entries(allocations)) {
            if (allocAmount <= 0) continue;
            const allocInput = entityType === "customer"
                ? { invoiceId: docId, poId: null, amount: allocAmount }
                : { invoiceId: null, poId: docId, amount: allocAmount };
            await addPaymentAllocation(tenantId, result.data!.id, allocInput);
        }

        onCreated();
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[85vh] overflow-auto">
                <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold">
                        New {entityType === "customer" ? "Customer Receipt" : "Vendor Payment"}
                    </h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                    {/* Entity */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">
                            {entityType === "customer" ? "Customer" : "Vendor"} *
                        </label>
                        <select
                            value={entityId}
                            onChange={(e) => setEntityId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                        >
                            <option value="">Select...</option>
                            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>

                    {/* Amount + Method */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Amount *</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Method</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                            >
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cash">Cash</option>
                                <option value="check">Check</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Date + Reference */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Reference</label>
                            <input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Check #, transfer ref..."
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Notes</label>
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1"
                        />
                    </div>

                    {/* Outstanding Documents / Allocations */}
                    {entityId && docs.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                                Allocate to {entityType === "customer" ? "Invoices" : "Purchase Orders"}
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-auto">
                                {docs.map((doc) => {
                                    const docNum = doc.invoice_number || doc.po_number || "—";
                                    const docTotal = doc.balance_due ?? doc.total ?? doc.total_amount ?? 0;
                                    return (
                                        <div key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                                            <div className="flex-1 min-w-0">
                                                <span className="font-mono text-xs">{docNum}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({fmt(docTotal)} due)</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={docTotal}
                                                value={allocations[doc.id] || ""}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setAllocations((prev) => ({ ...prev, [doc.id]: val }));
                                                }}
                                                placeholder="0.00"
                                                className="w-28 px-2 py-1 rounded border border-border bg-background text-sm text-right tabular-nums"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 text-xs flex justify-between text-muted-foreground">
                                <span>Allocated: {fmt(allocatedTotal)}</span>
                                <span className={allocatedTotal !== amount && amount > 0 ? "text-amber-600" : ""}>
                                    {allocatedTotal === amount ? "✓ Fully allocated" : `Unallocated: ${fmt(amount - allocatedTotal)}`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                    <button
                        onClick={handleCreate}
                        disabled={saving}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}
