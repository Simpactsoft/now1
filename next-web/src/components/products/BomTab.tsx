"use client";

import { useState, useEffect, useMemo } from "react";
import { Package } from "lucide-react";
import { useEntityView, EntityViewLayout, ColumnDef } from "@/components/entity-view";
import { BomTreeView } from "@/components/entity-view/BomTreeView";

interface BomTreeNode {
    id: string;
    bom_header_id: string;
    parent_item_id: string | null;
    component_product_id: string;
    level: number;
    sequence: number;
    quantity: number;
    total_quantity: number;
    unit: string;
    scrap_factor: number;
    is_assembly: boolean;
    is_phantom: boolean;
    sku: string;
    name: string;
    cost_price: number;
    list_price: number;
    extended_cost: number;
    extended_price: number;
    path: string[] | string;
}

interface BomTabProps {
    productId: string;
    productName: string;
}

export default function BomTab({ productId, productName }: BomTabProps) {
    const [bomData, setBomData] = useState<BomTreeNode[]>([]);
    const [totalCost, setTotalCost] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch BOM data
    useEffect(() => {
        if (!productId) return;

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
            } catch (error) {
                console.error("Error fetching BOM:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBomData();
    }, [productId]);

    // Calculate subtotals for assemblies
    const enrichedBomData = useMemo(() => {
        if (!bomData.length) return [];

        // Create a map to find children by parent path
        const itemsByParentPath = new Map<string, BomTreeNode[]>();
        bomData.forEach(item => {
            const pathArray = Array.isArray(item.path) ? item.path : (item.path as string).split(' > ');
            const pathString = pathArray.join(' > ');

            if (pathArray.length > 1) {
                const parentPath = pathArray.slice(0, -1).join(' > ');
                if (!itemsByParentPath.has(parentPath)) {
                    itemsByParentPath.set(parentPath, []);
                }
                itemsByParentPath.get(parentPath)!.push(item);
            }
        });

        // Calculate subtotals for each item
        return bomData.map(item => {
            const pathArray = Array.isArray(item.path) ? item.path : (item.path as string).split(' > ');
            const pathString = pathArray.join(' > ');
            const children = itemsByParentPath.get(pathString) || [];

            if (children.length > 0) {
                // This is an assembly with children - calculate subtotals
                const subtotal_qty = children.reduce((sum, child) => sum + child.quantity, 0);
                const subtotal_cost = children.reduce((sum, child) => sum + child.extended_cost, 0);
                return {
                    ...item,
                    quantity: subtotal_qty,
                    extended_cost: subtotal_cost,
                };
            }
            return item;
        });
    }, [bomData]);

    // Entity View Hook
    const entityView = useEntityView<BomTreeNode>({
        entityType: "bom",
        initialData: enrichedBomData,
        initialViewMode: "tree",
        initialPageSize: 10000,
        getItemId: (item) => item.id || (item as any).item_id,
    });

    // Column Definitions
    const columns = useMemo<ColumnDef<BomTreeNode>[]>(() => [
        {
            field: "image",
            headerName: "",
            width: 60,
            cellRenderer: (params: any) => {
                const imageUrl = params.data?.custom_fields?.image_url;
                if (imageUrl) {
                    return `<img src="${imageUrl}" alt="${params.data?.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" />`;
                }
                return '';
            },
        },
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
            aggFunc: "sum",
        },
        {
            field: "unit_cost",
            headerName: "Unit Cost",
            width: 120,
            valueFormatter: (value) => `₪${value?.toLocaleString()}`,
            valueGetter: (data) => data.cost_price || data.list_price || 0,
        },
        {
            field: "extended_cost",
            headerName: "Extended Cost",
            width: 150,
            valueFormatter: (value) => `₪${value?.toLocaleString()}`,
            aggFunc: "sum",
        },
        {
            field: "unit",
            headerName: "Unit",
            width: 80,
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
    ], []);

    return (
        <div className="w-full bg-card border border-border rounded-lg shadow-sm flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Bill of Materials</h2>
                    <p className="text-sm text-muted-foreground">{productName}</p>
                </div>
            </div>

            {/* EntityViewLayout */}
            <div className="overflow-hidden">
                <EntityViewLayout<BomTreeNode>
                    entityType="bom"
                    tenantId="00000000-0000-0000-0000-000000000000"
                    columns={columns}
                    config={{
                        ...entityView,
                        data: enrichedBomData,
                        filteredData: enrichedBomData,
                        loading,
                    }}
                    availableViewModes={['tree', 'tags', 'cards']}
                    defaultViewMode="tree"
                    renderTree={(props) => (
                        <BomTreeView
                            data={props.data}
                            columns={columns}
                            getItemId={(item) => item.id || (item as any).item_id}
                            getLevel={(item) => item.level}
                            getPath={(item) => Array.isArray(item.path) ? item.path.join(' > ') : item.path}
                            onRowClick={props.onRowClick}
                        />
                    )}
                    renderTags={(props) => (
                        <div className="flex flex-wrap gap-2 p-4">
                            {props.data.map((item) => (
                                <button
                                    key={item.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                                >
                                    <span className="font-semibold">{item.sku}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="truncate max-w-[200px]">{item.name}</span>
                                    {item.is_assembly && (
                                        <Package className="w-3.5 h-3.5 text-blue-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    renderCards={(props) => (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                            {props.data.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-card"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-semibold">{item.sku}</h4>
                                            <p className="text-sm text-muted-foreground">{item.name}</p>
                                        </div>
                                        {item.is_assembly && (
                                            <Package className="w-5 h-5 text-blue-500" />
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Qty:</span>
                                            <span className="ml-1 font-medium">{item.quantity}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Unit Cost:</span>
                                            <span className="ml-1 font-medium">₪{(item.cost_price || item.list_price || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">Total:</span>
                                            <span className="ml-1 font-semibold">₪{item.extended_cost?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex justify-between items-center bg-muted/20">
                <button
                    onClick={() => { }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    Export BOM
                </button>
                <div className="text-sm font-medium">
                    Total BOM Cost: <span className="text-primary text-lg ml-2">₪{totalCost.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
