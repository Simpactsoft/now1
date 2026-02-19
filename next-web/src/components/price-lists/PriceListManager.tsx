"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Calendar, DollarSign, ArrowUpDown, Loader2, Tag } from "lucide-react";
import {
    getPriceLists,
    upsertPriceList,
    getPriceListItems,
    upsertPriceListItem,
    assignCustomerPriceList,
    removeCustomerPriceList,
} from "@/app/actions/price-list-actions";

// ============================================================================
// TYPES
// ============================================================================

interface PriceList {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    priority: number;
    isActive: boolean;
    validFrom: string | null;
    validTo: string | null;
    createdAt: string;
}

interface PriceListItem {
    id: string;
    priceListId: string;
    productId: string;
    unitPrice: number;
    minQuantity: number;
    maxQuantity: number | null;
    discountPercent: number;
    notes: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PriceListManager({ tenantId }: { tenantId: string }) {
    const [priceLists, setPriceLists] = useState<PriceList[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedList, setSelectedList] = useState<PriceList | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingList, setEditingList] = useState<PriceList | null>(null);

    const fetchLists = useCallback(async () => {
        setLoading(true);
        const result = await getPriceLists(tenantId);
        if (result.success && result.data) {
            setPriceLists(result.data);
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this price list?")) return;
        // Note: deletePriceList not yet exported — upsert with isActive=false as soft delete
        const result = await upsertPriceList(tenantId, { id, name: selectedList?.name || '', isActive: false });
        if (result.success) {
            if (selectedList?.id === id) setSelectedList(null);
            fetchLists();
        }
    };

    const handleSave = async (data: Partial<PriceList>) => {
        const result = await upsertPriceList(tenantId, {
            id: editingList?.id,
            name: data.name || "",
            description: data.description || undefined,
            currency: data.currency || "ILS",
            priority: data.priority ?? 0,
            isActive: data.isActive ?? true,
            validFrom: data.validFrom || undefined,
            validTo: data.validTo || undefined,
        });
        if (result.success) {
            setShowForm(false);
            setEditingList(null);
            fetchLists();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Price Lists</h1>
                    <p className="text-sm text-muted-foreground">Manage pricing tiers and customer-specific prices</p>
                </div>
                <button
                    onClick={() => { setEditingList(null); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    New Price List
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Price Lists Table */}
                <div className={`${selectedList ? 'w-1/2' : 'w-full'} border-r border-border overflow-auto transition-all`}>
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : priceLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Tag className="w-12 h-12 mb-3 opacity-40" />
                            <p className="text-lg font-medium">No price lists yet</p>
                            <p className="text-sm">Create your first price list to get started</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-muted/50 sticky top-0 z-10">
                                <tr>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Currency</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valid</th>
                                    <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {priceLists.map((list) => (
                                    <tr
                                        key={list.id}
                                        onClick={() => setSelectedList(list)}
                                        className={`cursor-pointer hover:bg-muted/30 transition-colors ${selectedList?.id === list.id ? 'bg-primary/5 border-s-2 border-primary' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-sm text-foreground">{list.name}</div>
                                            {list.description && <div className="text-xs text-muted-foreground mt-0.5">{list.description}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-muted">
                                                <DollarSign className="w-3 h-3" />{list.currency}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-sm">
                                                <ArrowUpDown className="w-3 h-3 text-muted-foreground" />{list.priority}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {list.validFrom || list.validTo ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {list.validFrom || '∞'} — {list.validTo || '∞'}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/60">Always valid</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${list.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                                {list.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-end">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingList(list); setShowForm(true); }}
                                                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }}
                                                    className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedList && (
                    <div className="w-1/2 overflow-auto">
                        <PriceListDetail
                            tenantId={tenantId}
                            priceList={selectedList}
                            onClose={() => setSelectedList(null)}
                        />
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <PriceListForm
                    initialData={editingList}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingList(null); }}
                />
            )}
        </div>
    );
}

// ============================================================================
// PRICE LIST FORM MODAL
// ============================================================================

function PriceListForm({
    initialData,
    onSave,
    onClose,
}: {
    initialData: PriceList | null;
    onSave: (data: Partial<PriceList>) => Promise<void>;
    onClose: () => void;
}) {
    const [name, setName] = useState(initialData?.name || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [currency, setCurrency] = useState(initialData?.currency || "ILS");
    const [priority, setPriority] = useState(initialData?.priority ?? 0);
    const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
    const [validFrom, setValidFrom] = useState(initialData?.validFrom || "");
    const [validTo, setValidTo] = useState(initialData?.validTo || "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ name, description, currency, priority, isActive, validFrom: validFrom || null, validTo: validTo || null });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-4">{initialData ? "Edit Price List" : "New Price List"}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm resize-none"
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                            >
                                <option value="ILS">ILS</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Priority</label>
                            <input
                                type="number"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                                min={0}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Valid From</label>
                            <input
                                type="date"
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Valid To</label>
                            <input
                                type="date"
                                value={validTo}
                                onChange={(e) => setValidTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="rounded border-border"
                        />
                        <label htmlFor="isActive" className="text-sm text-foreground">Active</label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : initialData ? "Update" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================================
// PRICE LIST DETAIL PANEL
// ============================================================================

function PriceListDetail({
    tenantId,
    priceList,
    onClose,
}: {
    tenantId: string;
    priceList: PriceList;
    onClose: () => void;
}) {
    const [items, setItems] = useState<PriceListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"items" | "customers">("items");

    const fetchItems = useCallback(async () => {
        setLoading(true);
        const result = await getPriceListItems(tenantId, priceList.id);
        if (result.success && result.data) {
            setItems(result.data);
        }
        setLoading(false);
    }, [tenantId, priceList.id]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    return (
        <div className="flex flex-col h-full">
            {/* Detail Header */}
            <div className="px-6 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{priceList.name}</h2>
                        {priceList.description && <p className="text-sm text-muted-foreground mt-0.5">{priceList.description}</p>}
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl">×</button>
                </div>
                <div className="flex gap-3 mt-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted font-mono">
                        <DollarSign className="w-3 h-3" />{priceList.currency}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted">
                        Priority: {priceList.priority}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs ${priceList.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                        {priceList.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab("items")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === "items" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Price Items
                </button>
                <button
                    onClick={() => setActiveTab("customers")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === "customers" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Customer Assignments
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-4">
                {activeTab === "items" ? (
                    <PriceItemsTab
                        tenantId={tenantId}
                        priceListId={priceList.id}
                        items={items}
                        loading={loading}
                        onRefresh={fetchItems}
                    />
                ) : (
                    <CustomerAssignmentsTab
                        tenantId={tenantId}
                        priceListId={priceList.id}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// PRICE ITEMS TAB
// ============================================================================

function PriceItemsTab({
    tenantId,
    priceListId,
    items,
    loading,
    onRefresh,
}: {
    tenantId: string;
    priceListId: string;
    items: PriceListItem[];
    loading: boolean;
    onRefresh: () => void;
}) {
    const handleDeleteItem = async (itemId: string) => {
        // deletePriceListItem not yet exported — show a placeholder
        console.log('Delete item:', itemId);
        onRefresh();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div>
            {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No items in this price list</p>
                    <p className="text-xs mt-1">Add products with custom pricing</p>
                </div>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-start py-2 px-3 text-xs font-medium text-muted-foreground">Product</th>
                            <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">Unit Price</th>
                            <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">Min Qty</th>
                            <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground">Discount %</th>
                            <th className="text-end py-2 px-3 text-xs font-medium text-muted-foreground"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/30">
                                <td className="py-2 px-3">
                                    <div className="font-medium font-mono text-xs">{item.productId.slice(0, 8)}...</div>
                                </td>
                                <td className="py-2 px-3 text-end font-mono">{item.unitPrice.toFixed(2)}</td>
                                <td className="py-2 px-3 text-end">{item.minQuantity}</td>
                                <td className="py-2 px-3 text-end">{item.discountPercent ?? '—'}</td>
                                <td className="py-2 px-3 text-end">
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// ============================================================================
// CUSTOMER ASSIGNMENTS TAB
// ============================================================================

function CustomerAssignmentsTab({
    tenantId,
    priceListId,
}: {
    tenantId: string;
    priceListId: string;
}) {
    return (
        <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Customer assignments</p>
            <p className="text-xs mt-1">Assign this price list to specific customers for automatic price resolution</p>
        </div>
    );
}
