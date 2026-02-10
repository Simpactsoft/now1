"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, MoreHorizontal, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useLanguage } from '@/context/LanguageContext';
import { EntityTreeGrid } from '@/components/entity-view/EntityTreeGrid';
import { ColumnDef } from '@/components/entity-view';

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
    const [showBom, setShowBom] = useState(true);
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

    // BOM columns
    const bomColumns = useMemo<ColumnDef<BomTreeNode>[]>(() => [
        {
            field: "sku",
            headerName: "SKU",
            minWidth: 150,
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
            valueFormatter: (params) => params.value ? `₪${params.value.toLocaleString()}` : '',
        },
        {
            field: "extended_cost",
            headerName: "Extended Cost",
            width: 150,
            valueFormatter: (params) => params.value ? `₪${params.value.toLocaleString()}` : '',
            aggFunc: "sum",
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
        <div className="bg-card border border-border rounded-xl shadow-sm">
            {/* Header */}
            <div className="p-6 border-b border-border">
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

            {/* Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-border">
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

            {/* BOM Section */}
            {enrichedBomData.length > 0 && (
                <div className="p-6">
                    <button
                        onClick={() => setShowBom(!showBom)}
                        className="flex items-center justify-between w-full text-left mb-4 group"
                    >
                        <div className="flex items-center gap-2">
                            <Package size={20} className="text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Bill of Materials</h2>
                            <span className="text-sm text-muted-foreground">({enrichedBomData.length} items)</span>
                        </div>
                        {showBom ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
                    </button>

                    {showBom && (
                        <div className="border border-border rounded-lg" style={{ height: '500px' }}>
                            <EntityTreeGrid
                                data={enrichedBomData}
                                columns={bomColumns}
                                loading={loading}
                                selectedIds={new Set()}
                                onSelectionChange={() => { }}
                                getDataPath={(item: BomTreeNode) => {
                                    const parts = item.path.split(' > ');
                                    return parts.length > 1 ? parts.slice(1) : parts;
                                }}
                                autoGroupColumnDef={{
                                    headerName: 'Component Hierarchy',
                                    minWidth: 300,
                                    cellRendererParams: {
                                        suppressCount: false,
                                    }
                                }}
                                className="h-full"
                            />
                        </div>
                    )}

                    {showBom && totalCost > 0 && (
                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                            <span className="text-sm font-semibold text-muted-foreground">Total BOM Cost:</span>
                            <span className="text-lg font-bold">₪{totalCost.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


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
    const [showBom, setShowBom] = useState(true);
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
                    throw new Error(result.error || "Failed to fetch BOM");
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
            valueFormatter: (params) => params.value ? `₪${params.value.toLocaleString()}` : '',
        },
        {
            field: "extended_cost",
            headerName: "Extended Cost",
            width: 150,
            valueFormatter: (params) => params.value ? `₪${params.value.toLocaleString()}` : '',
            aggFunc: "sum",
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
        <div className="group bg-card hover:bg-muted/30 border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col">
            {/* Top Gradient Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/50 to-emerald-500/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl" />

            {/* Header: Icon + Name + Menu */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner bg-green-50 text-green-600">
                        <Package size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground line-clamp-1 text-lg group-hover:text-primary transition-colors">
                            {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            {product.sku}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative" ref={menuRef}>
                    {product.status && (
                        <div className="scale-90 origin-right">
                            <StatusBadge status={product.status} tenantId={tenantId} />
                        </div>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className={`text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-slate-100 transition-colors ${showMenu ? 'bg-slate-100 text-foreground' : ''}`}
                    >
                        <MoreHorizontal size={18} />
                    </button>

                    {showMenu && (
                        <div className="absolute top-full right-0 mt-1 w-36 bg-popover border border-border rounded-lg shadow-lg z-10 py-1 animate-in fade-in zoom-in-95 duration-100">
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

            {/* Body: Product Details */}
            <div className="space-y-1.5 flex-grow">
                {product.cost_price !== undefined && (
                    <div className="group/item flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors relative h-7 rounded px-1 -mx-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 truncate pr-6 min-w-0">
                            <span className="shrink-0">💰</span>
                            <span className="truncate font-medium">Cost Price: ₪{product.cost_price.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(product.cost_price!.toString()); }}
                            className="p-1 hover:bg-background rounded-md text-muted-foreground transition-opacity absolute right-1 shadow-sm border border-border/50"
                            title="Copy Cost"
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                {product.list_price !== undefined && (
                    <div className="group/item flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors relative h-7 rounded px-1 -mx-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 truncate pr-6 min-w-0">
                            <span className="shrink-0">🏷️</span>
                            <span className="truncate font-medium">List Price: ₪{product.list_price.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(product.list_price!.toString()); }}
                            className="p-1 hover:bg-background rounded-md text-muted-foreground transition-opacity absolute right-1 shadow-sm border border-border/50"
                            title="Copy Price"
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                {product.product_type && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate h-7 px-1">
                        <span className="shrink-0">📦</span>
                        <span className="truncate">Type: {product.product_type}</span>
                    </div>
                )}
                {product.track_inventory !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate h-7 px-1">
                        <span className="shrink-0">📊</span>
                        <span className="truncate">Track Inventory: {product.track_inventory ? 'Yes' : 'No'}</span>
                    </div>
                )}
            </div>

            {/* BOM Section */}
            {enrichedBomData.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/50">
                    <button
                        onClick={() => setShowBom(!showBom)}
                        className="flex items-center justify-between w-full text-left mb-3 group/bom"
                    >
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <Package size={16} className="text-muted-foreground" />
                            Bill of Materials
                            <span className="text-xs text-muted-foreground font-normal">({enrichedBomData.length} items)</span>
                        </h4>
                        {showBom ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </button>

                    {showBom && (
                        <div className="bg-muted/30 rounded-lg p-3 -mx-2" style={{ minHeight: '300px', maxHeight: '600px' }}>
                            <EntityTreeGrid
                                data={enrichedBomData}
                                columns={bomColumns}
                                loading={loading}
                                selectedIds={new Set()}
                                onSelectionChange={() => { }}
                                getDataPath={(item: BomTreeNode) => {
                                    const parts = item.path.split(' > ');
                                    return parts.length > 1 ? parts.slice(1) : parts;
                                }}
                                autoGroupColumnDef={{
                                    headerName: 'Component Hierarchy',
                                    minWidth: 300,
                                    cellRendererParams: {
                                        suppressCount: false,
                                    }
                                }}
                                className="h-full"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Footer: Stats */}
            <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                <div className="flex gap-4">
                    {enrichedBomData.length > 0 && (
                        <>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">BOM Items</span>
                                <span className="text-sm font-semibold text-foreground">{enrichedBomData.length}</span>
                            </div>
                            <div className="w-px h-8 bg-border" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Cost</span>
                                <span className="text-sm font-semibold text-foreground">₪{totalCost.toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </div>

                {onEdit && (
                    <button
                        onClick={() => onEdit(product.id)}
                        className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Edit size={14} />
                        {language === 'he' ? 'ערוך' : 'Edit'}
                    </button>
                )}
            </div>
        </div>
    );
}
