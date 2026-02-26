"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Palette, Box, Tag, Layers } from "lucide-react";
import {
    getVariantAttributes,
    createVariantAttribute,
    addVariantAttributeValue,
    getProductVariants,
    createVariant,
    deleteVariant,
} from "@/app/actions/variant-actions";

// ============================================================================
// TYPES
// ============================================================================

interface VariantAttribute {
    id: string;
    name: string;
    displayName: string | null;
    values: { id: string; value: string; displayValue: string | null; colorHex: string | null }[];
}

interface ProductVariant {
    id: string;
    sku: string;
    name: string;
    attributeValues: Record<string, string>;
    costPrice: number;
    listPrice: number;
    isActive: boolean;
    barcode: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductVariantsPanel({
    tenantId,
    productId,
    productName,
}: {
    tenantId: string;
    productId: string;
    productName: string;
}) {
    const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddAttribute, setShowAddAttribute] = useState(false);
    const [showAddVariant, setShowAddVariant] = useState(false);
    const [generating, setGenerating] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [attrResult, varResult] = await Promise.all([
            getVariantAttributes(tenantId),
            getProductVariants(tenantId, productId),
        ]);
        if (attrResult.success && attrResult.data) setAttributes(attrResult.data);
        if (varResult.success && varResult.data) setVariants(varResult.data);
        setLoading(false);
    }, [tenantId, productId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDeleteVariant = async (variantId: string) => {
        if (!confirm("Delete this variant?")) return;
        const result = await deleteVariant(tenantId, variantId);
        if (result.success) fetchData();
    };

    // FIX 4: Generate all cartesian combinations
    const handleGenerateAll = async () => {
        // Filter attributes that have values
        const withValues = attributes.filter(a => a.values.length > 0);
        if (withValues.length === 0) {
            toast.warning('No attribute values defined. Add values to your attributes first.');
            return;
        }

        // Compute cartesian product
        const cartesian = (arrays: string[][]): string[][] => {
            return arrays.reduce<string[][]>(
                (acc, curr) => acc.flatMap(a => curr.map(c => [...a, c])),
                [[]]
            );
        };

        const attrNames = withValues.map(a => a.name);
        const attrValueArrays = withValues.map(a => a.values.map(v => v.value));
        const combinations = cartesian(attrValueArrays);

        // Filter out combinations that already exist
        const existingKeys = new Set(
            variants.map(v => JSON.stringify(
                attrNames.reduce<Record<string, string>>((acc, name) => {
                    acc[name] = v.attributeValues[name] || '';
                    return acc;
                }, {})
            ))
        );

        const newCombinations = combinations.filter(combo => {
            const key = JSON.stringify(
                attrNames.reduce<Record<string, string>>((acc, name, i) => {
                    acc[name] = combo[i];
                    return acc;
                }, {})
            );
            return !existingKeys.has(key);
        });

        if (newCombinations.length === 0) {
            toast.info('All combinations already exist.');
            return;
        }

        if (!confirm(`This will create ${newCombinations.length} new variant${newCombinations.length > 1 ? 's' : ''}. Continue?`)) {
            return;
        }

        setGenerating(true);
        let created = 0;
        for (const combo of newCombinations) {
            const attrValues = attrNames.reduce<Record<string, string>>((acc, name, i) => {
                acc[name] = combo[i];
                return acc;
            }, {});

            // Auto-generate SKU from product name + attribute values
            const skuSuffix = combo.map(v => v.toUpperCase().replace(/\s+/g, '')).join('-');
            const sku = `${productName.replace(/\s+/g, '-').toUpperCase().slice(0, 12)}-${skuSuffix}`;

            const result = await createVariant(tenantId, {
                parentProductId: productId,
                sku,
                attributeValues: attrValues,
                costPrice: 0,
                listPrice: 0,
            });
            if (result.success) created++;
        }

        toast.success(`Created ${created} of ${newCombinations.length} variants.`);
        setGenerating(false);
        fetchData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Attributes Section */}
            <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary" />
                        <h3 className="font-medium text-sm">Variant Attributes</h3>
                        <span className="text-xs text-muted-foreground">({attributes.length})</span>
                    </div>
                    <button
                        onClick={() => setShowAddAttribute(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> Add Attribute
                    </button>
                </div>
                <div className="p-4">
                    {attributes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No attributes defined. Add attributes like &quot;Color&quot;, &quot;Size&quot;, etc.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {attributes.map((attr) => (
                                <div key={attr.id} className="border border-border rounded-lg p-3 min-w-[150px]">
                                    <div className="font-medium text-sm mb-2">{attr.displayName || attr.name}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {attr.values.map((val) => (
                                            <span
                                                key={val.id}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted"
                                            >
                                                {val.colorHex && (
                                                    <span
                                                        className="w-3 h-3 rounded-full inline-block border border-border"
                                                        style={{ backgroundColor: val.colorHex }}
                                                    />
                                                )}
                                                {val.displayValue || val.value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Variants Table */}
            <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-primary" />
                        <h3 className="font-medium text-sm">Product Variants</h3>
                        <span className="text-xs text-muted-foreground">({variants.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAddVariant(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Add Variant
                        </button>
                        {attributes.some(a => a.values.length > 0) && (
                            <button
                                onClick={handleGenerateAll}
                                disabled={generating}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
                            >
                                {generating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Layers className="w-3 h-3" />
                                )}
                                Generate All Combinations
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    {variants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Tag className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No variants created yet</p>
                            <p className="text-xs mt-1">Define attributes first, then add product variants</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">SKU</th>
                                    <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Name</th>
                                    <th className="text-start px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Attributes</th>
                                    <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Cost</th>
                                    <th className="text-end px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Price</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Status</th>
                                    <th className="px-4 py-2.5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {variants.map((v) => (
                                    <tr key={v.id} className="hover:bg-muted/20">
                                        <td className="px-4 py-2.5 font-mono text-xs">{v.sku}</td>
                                        <td className="px-4 py-2.5 font-medium">{v.name}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(v.attributeValues || {}).map(([key, val]) => (
                                                    <span key={key} className="px-1.5 py-0.5 rounded text-xs bg-muted">
                                                        {key}: {val}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-end font-mono">{v.costPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2.5 text-end font-mono">{v.listPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${v.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                                {v.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-end">
                                            <button
                                                onClick={() => handleDeleteVariant(v.id)}
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
            </div>

            {/* Add Attribute Modal */}
            {showAddAttribute && (
                <AddAttributeModal
                    tenantId={tenantId}
                    onClose={() => setShowAddAttribute(false)}
                    onSuccess={fetchData}
                />
            )}

            {/* Add Variant Modal */}
            {showAddVariant && (
                <AddVariantModal
                    tenantId={tenantId}
                    productId={productId}
                    attributes={attributes}
                    onClose={() => setShowAddVariant(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    );
}

// ============================================================================
// ADD ATTRIBUTE MODAL
// ============================================================================

function AddAttributeModal({
    tenantId,
    onClose,
    onSuccess,
}: {
    tenantId: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await createVariantAttribute(tenantId, { name });
        if (result.success) {
            onSuccess();
            onClose();
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">New Attribute</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Color, Size"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================================
// ADD VARIANT MODAL
// ============================================================================

function AddVariantModal({
    tenantId,
    productId,
    attributes,
    onClose,
    onSuccess,
}: {
    tenantId: string;
    productId: string;
    attributes: VariantAttribute[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [sku, setSku] = useState("");
    const [costPrice, setCostPrice] = useState(0);
    const [listPrice, setListPrice] = useState(0);
    const [attrValues, setAttrValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await createVariant(tenantId, {
            parentProductId: productId,
            sku,
            attributeValues: attrValues,
            costPrice,
            listPrice,
        });
        if (result.success) {
            onSuccess();
            onClose();
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">New Variant</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">SKU *</label>
                        <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                            required
                        />
                    </div>
                    {attributes.map((attr) => (
                        <div key={attr.id}>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">{attr.displayName || attr.name}</label>
                            <select
                                value={attrValues[attr.name] || ""}
                                onChange={(e) => setAttrValues(prev => ({ ...prev, [attr.name]: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                            >
                                <option value="">Select...</option>
                                {attr.values.map((val) => (
                                    <option key={val.id} value={val.value}>{val.displayValue || val.value}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Cost Price</label>
                            <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">List Price</label>
                            <input type="number" step="0.01" value={listPrice} onChange={(e) => setListPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button type="submit" disabled={saving || !sku.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
