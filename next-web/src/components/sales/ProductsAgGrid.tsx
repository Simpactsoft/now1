"use client";

import { useMemo } from "react";
import {
    ColDef,
    ICellRendererParams,
    ValueFormatterParams,
} from "ag-grid-community";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import EntityAgGrid from "@/components/EntityAgGrid";

// Interfaces (matching QuoteBuilder)
interface Category {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    stock_quantity: number;
    category_id?: string;
    category?: Category;
    sku?: string;
}

interface ProductsAgGridProps {
    products: Product[];
    loading: boolean;
    onAddToQuote: (product: Product) => void;
    className?: string;
}

export default function ProductsAgGrid({
    products,
    loading,
    onAddToQuote,
    className
}: ProductsAgGridProps) {
    // Column Definitions
    const columnDefs = useMemo<ColDef[]>(() => {
        return [
            {
                headerName: "",
                width: 60,
                pinned: 'left',
                sortable: false,
                filter: false,
                cellRenderer: (params: ICellRendererParams) => {
                    const product = params.data;
                    const isOutOfStock = product.stock_quantity <= 0;

                    return (
                        <div className="w-full h-full flex items-center justify-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isOutOfStock) {
                                        onAddToQuote(product);
                                    }
                                }}
                                disabled={isOutOfStock}
                                className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    isOutOfStock
                                        ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                        : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                )}
                                title={isOutOfStock ? "Out of Stock" : "Add to Quote"}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    );
                }
            },
            {
                field: "name",
                headerName: "Product Name",
                flex: 2,
                minWidth: 150,
                filter: true,
                cellRenderer: (params: ICellRendererParams) => {
                    return (
                        <div className="flex flex-col justify-center h-full leading-tight">
                            <span className="font-medium text-sm">{params.value}</span>
                            {params.data.description && (
                                <span className="text-xs text-muted-foreground truncate" title={params.data.description}>
                                    {params.data.description}
                                </span>
                            )}
                        </div>
                    );
                }
            },
            {
                field: "category.name",
                headerName: "Category",
                flex: 1,
                minWidth: 100,
                filter: true,
                valueFormatter: (params: ValueFormatterParams) => params.value || "-"
            },
            {
                field: "sku",
                headerName: "SKU",
                width: 120,
                filter: true,
                valueFormatter: (params: ValueFormatterParams) => params.value || "-"
            },
            {
                field: "price",
                headerName: "Price",
                width: 120,
                filter: 'agNumberColumnFilter',
                cellRenderer: (params: ICellRendererParams) => {
                    const price = params.value;
                    const currency = params.data.currency || 'USD';
                    return (
                        <div className="font-semibold text-sm">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)}
                        </div>
                    );
                }
            },
            {
                field: "stock_quantity",
                headerName: "Stock",
                width: 100,
                filter: 'agNumberColumnFilter',
                cellClass: (params) => params.value <= 0 ? "text-destructive font-medium" : "text-success",
                valueFormatter: (params: ValueFormatterParams) => params.value <= 0 ? "Out of Stock" : `${params.value} in stock`
            }
        ];
    }, [onAddToQuote]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), []);

    return (
        <EntityAgGrid
            rowData={products}
            columnDefs={columnDefs}
            loading={loading}
            className={className}
        />
    );
}

