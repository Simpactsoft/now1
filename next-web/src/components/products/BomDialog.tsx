"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import EntityViewLayout from "@/components/entity-view/EntityViewLayout";
import { useEntityView } from "@/components/entity-view/useEntityView";
import { ColumnDef } from "@/components/entity-view/types";
import { EntityTreeGrid } from "@/components/entity-view/EntityTreeGrid";
import { EntityAgGrid } from "@/components/entity-view/EntityAgGrid";

interface BomTreeNode {
    item_id: string;
    component_id: string;
    sku: string;
    name: string;
    level: number;
    quantity: number;
    unit_cost: number;
    extended_cost: number;
    is_assembly: boolean;
    path: string;
}

interface BomDialogProps {
    productId: string;
    productName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function BomDialog({ productId, productName, isOpen, onClose }: BomDialogProps) {
    const [bomData, setBomData] = useState<BomTreeNode[]>([]);
    const [totalCost, setTotalCost] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch BOM data
    useEffect(() => {
        if (!isOpen || !productId) return;

        const fetchBomData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/bom/${productId}?version=1.0`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Failed to fetch BOM");
                }

                setBomData(result.data.tree || []);
                setTotalCost(result.data.totalCost || 0);
                console.log('BOM Data fetched:', result.data.tree?.length, 'items', result.data.tree);
            } catch (err) {
                console.error("Error fetching BOM:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBomData();
    }, [productId, isOpen]);

    // Entity View Hook - automatically syncs with bomData via initialData
    const entityView = useEntityView<BomTreeNode>({
        entityType: "bom",
        initialData: bomData,
        initialViewMode: "tree",
        getItemId: (item) => item.item_id,
    });

    // Column Definitions
    const columns: ColumnDef<BomTreeNode>[] = [
        {
            field: "sku",
            headerName: "SKU",
            minWidth: 150,
            pinned: "left",
        },
        {
            field: "name",
            headerName: "Component",
            minWidth: 250,
            flex: 1,
        },
        {
            field: "quantity",
            headerName: "Qty",
            width: 100,
        },
        {
            field: "unit_cost",
            headerName: "Unit Cost",
            width: 120,
            valueFormatter: (value) => `₪${value?.toLocaleString()}`,
        },
        {
            field: "extended_cost",
            headerName: "Extended Cost",
            width: 150,
            valueFormatter: (value) => `₪${value?.toLocaleString()}`,
        },
        {
            field: "is_assembly",
            headerName: "Type",
            width: 120,
            cellRenderer: ({ value }) => (
                <span className={`text-xs px-2 py-0.5 rounded-full ${value
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    }`}>
                    {value ? "Assembly" : "Part"}
                </span>
            ),
        },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-bold">Bill of Materials</h2>
                        <p className="text-sm text-muted-foreground mt-1">{productName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Entity View Layout */}
                <div className="flex-1 overflow-auto p-6">
                    <EntityViewLayout<BomTreeNode>
                        entityType="bom"
                        columns={columns}
                        tenantId="00000000-0000-0000-0000-000000000000"
                        config={{
                            // Spread all properties from entityView to ensure nothing is missing
                            ...entityView,
                            // Ensure setFilters is compatible (config expects it, but hook doesn't have it)
                            setFilters: (filters: any[]) => {
                                // Clear existing and add new
                                entityView.clearFilters();
                                filters.forEach(filter => entityView.addFilter(filter));
                            },
                        }}
                        availableViewModes={["tags", "grid", "cards", "tree"]}
                        defaultViewMode="grid"
                        renderTags={(props) => (
                            <div className="flex flex-wrap gap-2">
                                {props.data.map((item) => (
                                    <button
                                        key={item.item_id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                                        onClick={() => props.onTagClick?.(item)}
                                    >
                                        <span className="font-semibold">{item.sku}</span>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="truncate max-w-[200px]">{item.name}</span>
                                        {item.is_assembly && (
                                            <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                                Assembly
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        renderCards={(props) => (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {props.data.map((item) => (
                                    <div
                                        key={item.item_id}
                                        className="p-5 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow cursor-pointer"
                                        onClick={() => props.onCardClick?.(item)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="font-bold text-lg">{item.name}</div>
                                                <div className="text-sm text-muted-foreground font-mono">{item.sku}</div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${item.is_assembly
                                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                                }`}>
                                                {item.is_assembly ? "Assembly" : "Part"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-3">
                                            {item.path}
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                                            <div>
                                                <div className="text-xs text-muted-foreground">Quantity</div>
                                                <div className="font-semibold">{item.quantity}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Unit Cost</div>
                                                <div className="font-semibold">₪{item.unit_cost.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Total</div>
                                                <div className="font-semibold text-primary">₪{item.extended_cost.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        renderGrid={(props) => {
                            console.log('[BomDialog renderGrid] props:', props);
                            return (
                                <div className="w-full h-[500px] flex flex-col">
                                    <EntityAgGrid
                                        {...props}
                                        showPagination={false}
                                        className="flex-1"
                                    />
                                </div>
                            );
                        }}
                        renderTree={(props) => {
                            console.log('[BomDialog renderTree] props:', props);
                            return (
                                <div className="w-full h-[500px] flex flex-col">
                                    <EntityTreeGrid
                                        {...props}
                                        getDataPath={(item: BomTreeNode) => item.path.split(' > ')}
                                        autoGroupColumnDef={{
                                            headerName: 'Component Hierarchy',
                                            minWidth: 300,
                                            cellRendererParams: {
                                                suppressCount: false,
                                            }
                                        }}
                                        className="flex-1"
                                    />
                                </div>
                            );
                        }}
                    />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-between items-center">
                    <div className="text-sm">
                        <span className="text-muted-foreground">Total BOM Cost: </span>
                        <span className="text-lg font-bold text-primary">₪{totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                            Close
                        </button>
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                            Export BOM
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
