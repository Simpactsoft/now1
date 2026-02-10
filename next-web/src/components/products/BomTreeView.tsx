"use client";

import { useState, useEffect } from "react";
import { Package, Loader2, Box } from "lucide-react";

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

interface BomTreeViewProps {
    productId: string;
    version?: string;
}

export default function BomTreeView({ productId, version = "1.0" }: BomTreeViewProps) {
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<BomTreeNode[]>([]);
    const [totalCost, setTotalCost] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBomTree();
    }, [productId, version]);

    const fetchBomTree = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/bom/${productId}?version=${version}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to fetch BOM");
            }

            setTree(result.data.tree || []);
            setTotalCost(result.data.totalCost || 0);
        } catch (err: any) {
            console.error("Error fetching BOM tree:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderNode = (node: BomTreeNode, index: number) => {
        const depth = node.level;

        return (
            <div key={`${node.item_id}-${index}`} className="border-b border-border/50 last:border-0">
                <div
                    className={`flex items-center gap-2 p-3 transition-colors ${depth > 0 ? 'bg-muted/20' : ''}`}
                    style={{ paddingLeft: `${depth * 24 + 12}px` }}
                >
                    {/* Level Indicator */}
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    </div>

                    {/* Assembly Icon */}
                    <div className="flex-shrink-0">
                        {node.is_assembly ? (
                            <Box className="w-5 h-5 text-blue-500" />
                        ) : (
                            <Package className="w-5 h-5 text-green-600" />
                        )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 grid grid-cols-12 gap-4 items-center text-sm">
                        <div className="col-span-3">
                            <div className="font-semibold text-foreground">{node.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{node.sku}</div>
                        </div>

                        <div className="col-span-2 text-left text-muted-foreground text-xs font-mono">
                            {node.path}
                        </div>

                        <div className="col-span-2 text-center">
                            <span className="font-medium">{node.quantity}</span>
                        </div>

                        <div className="col-span-2 text-right">
                            <span className="font-mono">₪{node.unit_cost?.toLocaleString()}</span>
                        </div>

                        <div className="col-span-2 text-right">
                            <span className="font-mono font-semibold">₪{node.extended_cost?.toLocaleString()}</span>
                        </div>

                        <div className="col-span-1 text-right">
                            {node.is_assembly && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                    Assembly
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500">{error}</p>
                <button
                    onClick={fetchBomTree}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (tree.length === 0) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                No BOM defined for this product.
            </div>
        );
    }

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
            {/* Header */}
            <div className="bg-muted/50 p-3 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase">
                    <div className="col-span-3 pl-6">Component</div>
                    <div className="col-span-2 text-left">Path</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit Cost</div>
                    <div className="col-span-2 text-right">Extended Cost</div>
                    <div className="col-span-1 text-right">Type</div>
                </div>
            </div>

            {/* Tree */}
            <div className="max-h-[600px] overflow-y-auto">
                {tree.map((node, index) => renderNode(node, index))}
            </div>

            {/* Footer - Total Cost */}
            <div className="bg-muted/50 p-3 border-t border-border flex justify-between items-center">
                <div className="text-sm font-semibold">Total BOM Cost</div>
                <div className="text-lg font-bold text-primary">₪{totalCost.toLocaleString()}</div>
            </div>
        </div>
    );
}
