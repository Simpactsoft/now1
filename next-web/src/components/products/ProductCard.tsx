"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/context/LanguageContext';
import { useEntityView, EntityViewLayout, ColumnDef } from '@/components/entity-view';

interface ProductCardProps {
    product: {
        id: string;
        sku: string;
        name: string;
        status?: string;
        cost_price?: number;
        list_price?: number;
        product_type?: string;
        track_inventory?: boolean;
        custom_fields?: Record<string, any>;
    };
    tenantId: string;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

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
    custom_fields?: Record<string, any>;
}

export default function ProductCard({ product, tenantId, onEdit, onDelete }: ProductCardProps) {
    const { language } = useLanguage();
    const [showMenu, setShowMenu] = useState(false);
    const [bomData, setBomData] = useState<BomTreeNode[]>([]);
    const [totalCost, setTotalCost] = useState(0);
    const [loading, setLoading] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fetch BOM data
    useEffect(() => {
        if (!product.id) return;

        const fetchBomData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/bom/${product.id}?version=1.0`);
                const result = await response.json();

                if (!response.ok) {
                    console.error("Failed to fetch BOM:", result.error);
                    setBomData([]);
                    return;
                }

                setBomData(result.data.tree || []);
                setTotalCost(result.data.total_cost || 0);
            } catch (error) {
                console.error("Error fetching BOM:", error);
                setBomData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBomData();
    }, [product.id]);

    // Calculate enriched BOM data with subtotals
    const enrichedBomData = useMemo(() => {
        if (!bomData.length) return [];

        const itemsByParentPath = new Map<string, BomTreeNode[]>();
        bomData.forEach(item => {
            const pathParts = item.path.split(' > ');
            if (pathParts.length > 1) {
                const parentPath = pathParts.slice(0, -1).join(' > ');
                if (!itemsByParentPath.has(parentPath)) {
                    itemsByParentPath.set(parentPath, []);
                }
                itemsByParentPath.get(parentPath)!.push(item);
            }
        });

        return bomData.map(item => {
            const children = itemsByParentPath.get(item.path) || [];
            if (children.length > 0) {
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
    // initialData is reactive - useEntityView watches it and calls setData internally (line 149-153)
    const entityView = useEntityView<BomTreeNode>({
        entityType: "bom",
        initialData: enrichedBomData, // Reactive! Hook will update when this changes
        initialViewMode: "tree",
        initialPageSize: 10000,
        getItemId: (item) => item.item_id,
    });

    // BOM columns
    const bomColumns = useMemo<ColumnDef<BomTreeNode>[]>(() => [
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
        },
        {
            field: "extended_cost",
            headerName: "Extended Cost",
            width: 150,
            valueFormatter: (value) => `₪${value?.toLocaleString()}`,
            aggFunc: "sum",
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

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
                        <p className="text-sm text-muted-foreground mt-1">SKU: {product.sku}</p>
                    </div>
                    <div className="flex items-center gap-2 relative" ref={menuRef}>
                        {product.status && (
                            <StatusBadge status={product.status} tenantId={tenantId} />
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            className={`text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted transition-colors ${showMenu ? 'bg-muted text-foreground' : ''}`}
                        >
                            <MoreHorizontal size={20} />
                        </button>

                        {showMenu && (
                            <div className="absolute top-full right-0 mt-1 w-36 bg-popover border border-border rounded-lg shadow-lg z-10 py-1">
                                {onEdit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(product.id); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                                    >
                                        <Edit size={14} />
                                        <span>{language === 'he' ? 'ערוך' : 'Edit'}</span>
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            if (confirm(language === 'he' ? 'האם אתה בטוח?' : 'Are you sure?')) onDelete(product.id);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-destructive/10 text-destructive hover:text-destructive flex items-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        <span>{language === 'he' ? 'מחק' : 'Delete'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Details Card - Compact Width */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pricing */}
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pricing</h2>
                        <div className="space-y-2">
                            {product.cost_price !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Cost Price:</span>
                                    <span className="text-sm font-medium">₪{product.cost_price.toLocaleString()}</span>
                                </div>
                            )}
                            {product.list_price !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">List Price:</span>
                                    <span className="text-sm font-bold">₪{product.list_price.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Inventory */}
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Inventory</h2>
                        <div className="space-y-2">
                            {product.track_inventory !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Track Inventory:</span>
                                    <span className="text-sm">{product.track_inventory ? 'Yes' : 'No'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Type */}
                    {product.product_type && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Type</h2>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Product Type:</span>
                                    <span className="text-sm">{product.product_type}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BOM Card */}
            {enrichedBomData.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm">
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Package size={20} className="text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Bill of Materials</h2>
                            <span className="text-sm text-muted-foreground">({enrichedBomData.length} items)</span>
                        </div>
                        {totalCost > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Total Cost: <span className="font-semibold">₪{totalCost.toLocaleString()}</span>
                            </p>
                        )}
                    </div>

                    {/* EntityViewLayout with Tree/Tags/Cards */}
                    {/* CRITICAL: key forces re-mount when data changes, fixing initial empty state */}
                    <div style={{ height: '600px' }}>
                        <EntityViewLayout<BomTreeNode>
                            key={`bom-${enrichedBomData.length}-${loading}`}
                            entityType="bom"
                            tenantId={tenantId}
                            columns={bomColumns}
                            config={{
                                ...entityView,
                                data: enrichedBomData,
                                filteredData: enrichedBomData,
                                loading,
                            }}
                            availableViewModes={['tree', 'tags', 'cards']}
                            defaultViewMode="tree"
                            renderTags={(props) => (
                                <div className="flex flex-wrap gap-2 p-4">
                                    {props.data.map((item) => (
                                        <button
                                            key={item.item_id}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
                                        >
                                            <Package size={14} />
                                            <span>{item.name}</span>
                                            <span className="text-xs opacity-70">×{item.quantity}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            renderCards={(props) => (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                    {props.data.map((item) => (
                                        <div
                                            key={item.item_id}
                                            className="bg-background border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start gap-3">
                                                {item.custom_fields?.image_url && (
                                                    <img
                                                        src={item.custom_fields.image_url}
                                                        alt={item.name}
                                                        className="w-12 h-12 object-cover rounded"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">Qty:</span>
                                                            <span className="font-medium">{item.quantity}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">Cost:</span>
                                                            <span className="font-medium">₪{item.extended_cost.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
