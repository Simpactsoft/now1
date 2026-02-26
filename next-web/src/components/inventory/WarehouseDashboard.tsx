"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useCallback } from "react";
import {
    Warehouse,
    Plus,
    ArrowRightLeft,
    Loader2,
    Star,
    Package,
    MapPin,
    X,
} from "lucide-react";
import {
    getWarehouses,
    createWarehouse,
    setDefaultWarehouse,
    getWarehouseStock,
    getTransfers,
    createTransfer,
    executeTransfer,
} from "@/app/actions/warehouse-actions";

// ============================================================================
// TYPES
// ============================================================================

interface WarehouseView {
    id: string;
    code: string;
    name: string;
    address: string | null;
    isActive: boolean;
    isDefault: boolean;
}

interface StockView {
    productId: string;
    sku: string;
    productName: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
}

interface TransferView {
    id: string;
    transferNumber: number;
    fromWarehouseCode: string;
    toWarehouseCode: string;
    productSku: string;
    productName: string;
    quantity: number;
    status: string;
    completedAt: string | null;
    createdAt: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WarehouseDashboard({ tenantId }: { tenantId: string }) {
    const [activeTab, setActiveTab] = useState<"warehouses" | "transfers">("warehouses");

    const tabs = [
        { id: "warehouses" as const, label: "Warehouses", icon: Warehouse },
        { id: "transfers" as const, label: "Transfers", icon: ArrowRightLeft },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Warehouse Management</h1>
                <p className="text-sm text-muted-foreground">Manage warehouses and stock transfers</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === "warehouses" && <WarehousesTab tenantId={tenantId} />}
                {activeTab === "transfers" && <TransfersTab tenantId={tenantId} />}
            </div>
        </div>
    );
}

// ============================================================================
// WAREHOUSES TAB
// ============================================================================

function WarehousesTab({ tenantId }: { tenantId: string }) {
    const [warehouses, setWarehouses] = useState<WarehouseView[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
    const [stock, setStock] = useState<StockView[]>([]);
    const [stockLoading, setStockLoading] = useState(false);

    const fetchWarehouses = useCallback(async () => {
        setLoading(true);
        const result = await getWarehouses(tenantId);
        if (result.success && result.data) {
            setWarehouses(result.data);
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

    const handleSetDefault = async (whId: string) => {
        const result = await setDefaultWarehouse(tenantId, whId);
        if (result.success) {
            fetchWarehouses();
        } else {
            toast.error(`Failed: ${result.error}`);
        }
    };

    const handleViewStock = async (whId: string) => {
        if (selectedWarehouse === whId) {
            setSelectedWarehouse(null);
            return;
        }
        setSelectedWarehouse(whId);
        setStockLoading(true);
        const result = await getWarehouseStock(tenantId, whId);
        if (result.success && result.data) {
            setStock(result.data);
        }
        setStockLoading(false);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6 space-y-4">
            {/* Add Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Warehouse
                </button>
            </div>

            {warehouses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No warehouses yet</p>
                    <p className="text-xs mt-1">Add your first warehouse to start tracking inventory by location</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {warehouses.map((wh) => (
                        <div key={wh.id} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow bg-card">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{wh.code}</span>
                                        {wh.isDefault && (
                                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                                <Star className="w-3 h-3 fill-amber-500" /> Default
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-foreground mt-1">{wh.name}</h3>
                                </div>
                                {!wh.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(wh.id)}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        title="Set as default"
                                    >
                                        <Star className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {wh.address && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                                    <MapPin className="w-3 h-3" /> {wh.address}
                                </div>
                            )}
                            <button
                                onClick={() => handleViewStock(wh.id)}
                                className={`w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedWarehouse === wh.id
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'border-border hover:bg-muted'
                                    }`}
                            >
                                <Package className="w-3 h-3" />
                                {selectedWarehouse === wh.id ? 'Hide Stock' : 'View Stock'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Stock Panel */}
            {selectedWarehouse && (
                <div className="border border-border rounded-xl overflow-hidden mt-4">
                    <div className="px-4 py-3 bg-muted/50 font-medium text-sm flex items-center justify-between">
                        <span>Stock — {warehouses.find(w => w.id === selectedWarehouse)?.name}</span>
                        <button onClick={() => setSelectedWarehouse(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {stockLoading ? (
                        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : stock.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No stock in this warehouse</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground uppercase">SKU</th>
                                    <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Product</th>
                                    <th className="text-end px-4 py-2 text-xs font-medium text-muted-foreground uppercase">On Hand</th>
                                    <th className="text-end px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Reserved</th>
                                    <th className="text-end px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Available</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {stock.map(s => (
                                    <tr key={s.productId} className="hover:bg-muted/20">
                                        <td className="px-4 py-2 font-mono text-xs">{s.sku}</td>
                                        <td className="px-4 py-2">{s.productName}</td>
                                        <td className="px-4 py-2 text-end font-mono">{s.quantityOnHand}</td>
                                        <td className="px-4 py-2 text-end font-mono text-amber-600">{s.quantityReserved}</td>
                                        <td className={`px-4 py-2 text-end font-mono ${s.quantityAvailable > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{s.quantityAvailable}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Add Warehouse Modal */}
            {showForm && (
                <WarehouseFormModal
                    tenantId={tenantId}
                    onClose={() => setShowForm(false)}
                    onSuccess={fetchWarehouses}
                />
            )}
        </div>
    );
}

// ============================================================================
// WAREHOUSE FORM MODAL
// ============================================================================

function WarehouseFormModal({ tenantId, onClose, onSuccess }: { tenantId: string; onClose: () => void; onSuccess: () => void }) {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await createWarehouse(tenantId, { code, name, address: address || undefined, isDefault });
        if (result.success) {
            onSuccess();
            onClose();
        } else {
            toast.error(`Failed: ${result.error}`);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl border border-border">
                <h2 className="text-lg font-semibold mb-4">Add Warehouse</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Code *</label>
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="WH-TLV" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none font-mono" required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Name *</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="Tel Aviv Warehouse" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none" required />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Address</label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
                            className="rounded border-border" />
                        Set as default warehouse
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button type="submit" disabled={saving || !code.trim() || !name.trim()}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================================
// TRANSFERS TAB
// ============================================================================

function TransfersTab({ tenantId }: { tenantId: string }) {
    const [transfers, setTransfers] = useState<TransferView[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchTransfers = useCallback(async () => {
        setLoading(true);
        const result = await getTransfers(tenantId);
        if (result.success && result.data) {
            setTransfers(result.data.map(t => ({
                id: t.id,
                transferNumber: t.transferNumber,
                fromWarehouseCode: t.fromWarehouseCode,
                toWarehouseCode: t.toWarehouseCode,
                productSku: t.productSku,
                productName: t.productName,
                quantity: t.quantity,
                status: t.status,
                completedAt: t.completedAt,
                createdAt: t.createdAt,
            })));
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

    const handleExecute = async (transferId: string) => {
        setProcessingId(transferId);
        const result = await executeTransfer(tenantId, transferId);
        if (result.success) {
            fetchTransfers();
        } else {
            toast.error(`Failed: ${result.error}`);
        }
        setProcessingId(null);
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-500/10 text-amber-600',
        completed: 'bg-emerald-500/10 text-emerald-600',
        cancelled: 'bg-red-500/10 text-red-600',
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6">
            {transfers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No transfers yet</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">#</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Product</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">From → To</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Qty</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {transfers.map(t => (
                                <tr key={t.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-mono text-xs">{t.transferNumber}</td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs font-mono text-muted-foreground">{t.productSku}</div>
                                        <div>{t.productName}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {t.fromWarehouseCode} → {t.toWarehouseCode}
                                    </td>
                                    <td className="px-4 py-3 text-end font-mono">{t.quantity}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || ''}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {t.status === 'pending' && (
                                            <button
                                                onClick={() => handleExecute(t.id)}
                                                disabled={processingId === t.id}
                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                            >
                                                {processingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                Execute
                                            </button>
                                        )}
                                        {t.status === 'completed' && (
                                            <span className="text-xs text-muted-foreground">
                                                {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '—'}
                                            </span>
                                        )}
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
