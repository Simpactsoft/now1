"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useCallback } from "react";
import {
    ClipboardList,
    Loader2,
    Plus,
    Send,
    CheckCircle2,
    XCircle,
    Package,
    Truck,
    ChevronDown,
    ChevronRight,
    Building2,
    Search,
} from "lucide-react";
import {
    getVendors,
    createVendor,
    updateVendor,
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    submitPurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
} from "@/app/actions/purchase-order-actions";

// ============================================================================
// TYPES
// ============================================================================

interface Vendor {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    country: string | null;
    tax_id: string | null;
    payment_terms_days: number;
    notes: string | null;
    is_active: boolean;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    vendor_id: string;
    status: string;
    order_date: string | null;
    expected_delivery_date: string | null;
    subtotal: number;
    tax_amount: number;
    total: number;
    currency: string;
    notes: string | null;
    created_at: string;
    vendors: { id: string; name: string } | null;
}

interface POItem {
    id: string;
    product_id: string | null;
    variant_id: string | null;
    description: string;
    quantity: number;
    received_quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
}

interface PODetail extends PurchaseOrder {
    purchase_order_items: POItem[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PurchaseOrderDashboard({ tenantId }: { tenantId: string }) {
    const [activeTab, setActiveTab] = useState<"vendors" | "orders">("orders");

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
                <p className="text-sm text-muted-foreground">Manage vendors and purchase orders</p>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-border flex gap-0">
                {(["orders", "vendors"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {tab === "orders" ? "Purchase Orders" : "Vendors"}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === "vendors" ? (
                <VendorTab tenantId={tenantId} />
            ) : (
                <POTab tenantId={tenantId} />
            )}
        </div>
    );
}

// ============================================================================
// VENDOR TAB
// ============================================================================

function VendorTab({ tenantId }: { tenantId: string }) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

    const fetchVendors = useCallback(async () => {
        setLoading(true);
        const result = await getVendors(tenantId);
        if (result.success && result.data) {
            setVendors(result.data as Vendor[]);
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchVendors(); }, [fetchVendors]);

    const handleSave = async (data: Record<string, unknown>) => {
        if (editingVendor) {
            const result = await updateVendor(tenantId, editingVendor.id, data);
            if (!result.success) { toast.error(result.error); return; }
        } else {
            const result = await createVendor(tenantId, data as Parameters<typeof createVendor>[1]);
            if (!result.success) { toast.error(result.error); return; }
        }
        setShowDialog(false);
        setEditingVendor(null);
        fetchVendors();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{vendors.length} vendor(s)</span>
                <button
                    onClick={() => { setEditingVendor(null); setShowDialog(true); }}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5"
                >
                    <Plus size={14} /> Add Vendor
                </button>
            </div>

            {/* Vendor List */}
            {vendors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Building2 size={40} className="mb-2 opacity-50" />
                    <p>No vendors yet. Add your first vendor.</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {vendors.map((v) => (
                        <div
                            key={v.id}
                            className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer"
                            onClick={() => { setEditingVendor(v); setShowDialog(true); }}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-foreground">{v.name}</span>
                                    {!v.is_active && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">Inactive</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                                    {v.contact_name && <span>{v.contact_name}</span>}
                                    {v.email && <span>{v.email}</span>}
                                    {v.phone && <span>{v.phone}</span>}
                                </div>
                            </div>
                            {v.tax_id && <span className="text-xs text-muted-foreground font-mono">{v.tax_id}</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* Vendor Dialog */}
            {showDialog && (
                <VendorDialog
                    vendor={editingVendor}
                    onSave={handleSave}
                    onClose={() => { setShowDialog(false); setEditingVendor(null); }}
                />
            )}
        </div>
    );
}

function VendorDialog({
    vendor,
    onSave,
    onClose,
}: {
    vendor: Vendor | null;
    onSave: (data: Record<string, unknown>) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({
        name: vendor?.name ?? "",
        contactName: vendor?.contact_name ?? "",
        email: vendor?.email ?? "",
        phone: vendor?.phone ?? "",
        addressLine1: vendor?.address_line1 ?? "",
        city: vendor?.city ?? "",
        country: vendor?.country ?? "IL",
        taxId: vendor?.tax_id ?? "",
        paymentTermsDays: vendor?.payment_terms_days ?? 30,
        notes: vendor?.notes ?? "",
        isActive: vendor?.is_active ?? true,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-auto">
                <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold">{vendor ? "Edit Vendor" : "New Vendor"}</h2>
                </div>
                <div className="px-6 py-4 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Name *</label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
                            <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Email</label>
                            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Phone</label>
                            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Tax ID</label>
                            <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Address</label>
                        <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">City</label>
                            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Country</label>
                            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Payment Terms (days)</label>
                            <input type="number" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: parseInt(e.target.value) || 30 })}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="rounded border-border" />
                                Active
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Notes</label>
                        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1 h-16 resize-none" />
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {vendor ? "Save Changes" : "Create Vendor"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// PURCHASE ORDER TAB
// ============================================================================

function POTab({ tenantId }: { tenantId: string }) {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<PODetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        const result = await getPurchaseOrders(tenantId, filterStatus || undefined);
        if (result.success && result.data) {
            setOrders(result.data as PurchaseOrder[]);
        }
        setLoading(false);
    }, [tenantId, filterStatus]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleExpand = async (poId: string) => {
        if (expandedId === poId) { setExpandedId(null); return; }
        setExpandedId(poId);
        setDetailLoading(true);
        const result = await getPurchaseOrder(tenantId, poId);
        if (result.success && result.data) {
            setDetail(result.data as PODetail);
        }
        setDetailLoading(false);
    };

    const handleSubmit = async (poId: string) => {
        if (!confirm("Submit this PO for approval?")) return;
        setProcessingId(poId);
        const result = await submitPurchaseOrder(tenantId, poId);
        if (result.success) fetchOrders(); else toast.error(result.error);
        setProcessingId(null);
    };

    const handleApprove = async (poId: string) => {
        if (!confirm("Approve this PO?")) return;
        setProcessingId(poId);
        const result = await approvePurchaseOrder(tenantId, poId);
        if (result.success) fetchOrders(); else toast.error(result.error);
        setProcessingId(null);
    };

    const handleReceive = async (poId: string) => {
        if (!detail || detail.id !== poId) return;
        if (!confirm("Receive all remaining items? This will update inventory and create accounting entries.")) return;
        setProcessingId(poId);
        // Receive all outstanding quantities
        const items = detail.purchase_order_items
            .filter((i) => i.received_quantity < i.quantity)
            .map((i) => ({
                itemId: i.id,
                receivedQty: i.quantity - i.received_quantity,
            }));
        if (items.length === 0) { toast.warning("All items already received"); setProcessingId(null); return; }
        const result = await receivePurchaseOrder(tenantId, poId, items);
        if (result.success) fetchOrders(); else toast.error(result.error);
        setProcessingId(null);
    };

    const handleCancel = async (poId: string) => {
        if (!confirm("Cancel this PO?")) return;
        setProcessingId(poId);
        const result = await cancelPurchaseOrder(tenantId, poId);
        if (result.success) fetchOrders(); else toast.error(result.error);
        setProcessingId(null);
    };

    const statusColors: Record<string, string> = {
        draft: "bg-slate-500/10 text-slate-600",
        submitted: "bg-amber-500/10 text-amber-600",
        approved: "bg-blue-500/10 text-blue-600",
        received: "bg-emerald-500/10 text-emerald-600",
        partial: "bg-purple-500/10 text-purple-600",
        cancelled: "bg-red-500/10 text-red-600",
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
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="partial">Partial</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <span className="text-xs text-muted-foreground">{orders.length} order(s)</span>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5"
                >
                    <Plus size={14} /> New PO
                </button>
            </div>

            {/* PO List */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <ClipboardList size={40} className="mb-2 opacity-50" />
                    <p>No purchase orders found</p>
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {orders.map((po) => (
                        <div key={po.id}>
                            {/* PO Row */}
                            <div
                                className="px-6 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                                onClick={() => handleExpand(po.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {expandedId === po.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span className="font-mono text-sm font-medium text-foreground">{po.po_number}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${statusColors[po.status] || ""}`}>
                                            {po.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">{po.vendors?.name}</span>
                                        <span className="text-sm font-medium tabular-nums">{fmt(po.total, po.currency)}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 ml-7">
                                    {po.order_date && <span>Ordered: {po.order_date}</span>}
                                    {po.expected_delivery_date && <span className="ml-4">ETA: {po.expected_delivery_date}</span>}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {expandedId === po.id && (
                                <div className="px-6 pb-4 bg-secondary/10">
                                    {detailLoading ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                    ) : detail && detail.id === po.id ? (
                                        <div>
                                            {/* Items table */}
                                            <table className="w-full text-sm mt-2">
                                                <thead>
                                                    <tr className="text-xs text-muted-foreground border-b border-border">
                                                        <th className="text-left py-2 font-medium">Description</th>
                                                        <th className="text-right py-2 font-medium w-24">Qty</th>
                                                        <th className="text-right py-2 font-medium w-24">Received</th>
                                                        <th className="text-right py-2 font-medium w-28">Unit Price</th>
                                                        <th className="text-right py-2 font-medium w-28">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detail.purchase_order_items.map((item) => (
                                                        <tr key={item.id} className="border-b border-border/50">
                                                            <td className="py-2 text-foreground">{item.description}</td>
                                                            <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                                                            <td className="py-2 text-right tabular-nums">
                                                                <span className={item.received_quantity >= item.quantity ? "text-emerald-600" : "text-muted-foreground"}>
                                                                    {item.received_quantity}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 text-right tabular-nums">{fmt(item.unit_price, po.currency)}</td>
                                                            <td className="py-2 text-right tabular-nums font-medium">{fmt(item.line_total, po.currency)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Totals */}
                                            <div className="flex justify-end mt-3 text-sm">
                                                <div className="w-60 space-y-1">
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Subtotal</span>
                                                        <span className="tabular-nums">{fmt(po.subtotal, po.currency)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Tax</span>
                                                        <span className="tabular-nums">{fmt(po.tax_amount, po.currency)}</span>
                                                    </div>
                                                    <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
                                                        <span>Total</span>
                                                        <span className="tabular-nums">{fmt(po.total, po.currency)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="mt-4 flex items-center gap-2">
                                                {po.status === "draft" && (
                                                    <>
                                                        <button onClick={() => handleSubmit(po.id)} disabled={processingId === po.id}
                                                            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5">
                                                            {processingId === po.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                            Submit
                                                        </button>
                                                        <button onClick={() => handleCancel(po.id)} disabled={processingId === po.id}
                                                            className="px-3 py-1.5 bg-red-600/10 text-red-600 rounded-lg text-xs font-medium hover:bg-red-600/20 disabled:opacity-50 flex items-center gap-1.5">
                                                            <XCircle size={12} /> Cancel
                                                        </button>
                                                    </>
                                                )}
                                                {po.status === "submitted" && (
                                                    <>
                                                        <button onClick={() => handleApprove(po.id)} disabled={processingId === po.id}
                                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                                                            {processingId === po.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                            Approve
                                                        </button>
                                                        <button onClick={() => handleCancel(po.id)} disabled={processingId === po.id}
                                                            className="px-3 py-1.5 bg-red-600/10 text-red-600 rounded-lg text-xs font-medium hover:bg-red-600/20 disabled:opacity-50 flex items-center gap-1.5">
                                                            <XCircle size={12} /> Cancel
                                                        </button>
                                                    </>
                                                )}
                                                {(po.status === "approved" || po.status === "partial") && (
                                                    <button onClick={() => handleReceive(po.id)} disabled={processingId === po.id}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                                                        {processingId === po.id ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                                                        Receive All
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

            {/* Create PO dialog */}
            {showCreate && (
                <CreatePODialog
                    tenantId={tenantId}
                    onCreated={() => { setShowCreate(false); fetchOrders(); }}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}

// ============================================================================
// CREATE PO DIALOG
// ============================================================================

function CreatePODialog({
    tenantId,
    onCreated,
    onClose,
}: {
    tenantId: string;
    onCreated: () => void;
    onClose: () => void;
}) {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorId, setVendorId] = useState("");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
    const [expectedDate, setExpectedDate] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number; taxRate: number }[]>([
        { description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
    ]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getVendors(tenantId).then((r) => {
            if (r.success && r.data) setVendors(r.data as Vendor[]);
        });
    }, [tenantId]);

    const addItem = () => setItems([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, value: string | number) => {
        const updated = [...items];
        (updated[idx] as Record<string, unknown>)[field] = value;
        setItems(updated);
    };

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * i.taxRate, 0);
    const total = subtotal + taxTotal;

    const fmt = (n: number) => `₪ ${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleCreate = async () => {
        if (!vendorId) { toast.warning("Please select a vendor"); return; }
        if (items.some((i) => !i.description.trim())) { toast.warning("All items need a description"); return; }
        setSaving(true);
        const result = await createPurchaseOrder(
            tenantId,
            {
                vendorId,
                orderDate,
                expectedDeliveryDate: expectedDate || null,
                notes: notes || null,
            },
            items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                taxRate: i.taxRate,
            }))
        );
        if (result.success) {
            onCreated();
        } else {
            toast.error(result.error);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-auto">
                <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold">Create Purchase Order</h2>
                </div>
                <div className="px-6 py-4 space-y-4">
                    {/* Header Fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Vendor *</label>
                            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1">
                                <option value="">Select vendor...</option>
                                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Order Date</label>
                            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Expected Delivery</label>
                            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Notes</label>
                            <input value={notes} onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mt-1" />
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">Line Items</label>
                            <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Plus size={12} /> Add Item
                            </button>
                        </div>
                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                        <input placeholder="Description *" value={item.description}
                                            onChange={(e) => updateItem(idx, "description", e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" placeholder="Qty" value={item.quantity}
                                            onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" placeholder="Price" value={item.unitPrice}
                                            onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" step="0.01" placeholder="Tax%" value={item.taxRate}
                                            onChange={(e) => updateItem(idx, "taxRate", parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600">
                                                <XCircle size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end text-sm">
                        <div className="w-52 space-y-1">
                            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{fmt(taxTotal)}</span></div>
                            <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Total</span><span>{fmt(total)}</span></div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={handleCreate} disabled={saving}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        Create PO
                    </button>
                </div>
            </div>
        </div>
    );
}
