
import { ColumnDef } from "@/components/entity-view/types";
import { formatDistanceToNow } from "date-fns";
import { Package, AlertTriangle, Barcode, Tag } from "lucide-react";
import { Product } from "@/types/product";

export const productColumns: ColumnDef<Product>[] = [
    {
        field: "name",
        headerName: "Product",
        minWidth: 250,
        flex: 2,
        cellRenderer: ({ data }) => (
            <div className="flex items-center gap-3 py-1">
                {data.image_url ? (
                    <img src={data.image_url} className="w-10 h-10 rounded object-cover" alt="" />
                ) : (
                    <div className="w-10 h-10 bg-secondary/50 rounded flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                )}
                <div className="overflow-hidden">
                    <div className="font-medium truncate" title={data.name}>{data.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Barcode className="w-3 h-3" />
                        <span>{data.sku || '-'}</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        field: "category_name", // Flattened in API
        headerName: "Category",
        width: 150,
        cellRenderer: ({ value }) => (
            value ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md w-fit">
                    <Tag className="w-3 h-3" />
                    {value}
                </div>
            ) : <span className="text-muted-foreground">-</span>
        )
    },
    {
        field: "list_price",
        headerName: "Price",
        width: 120,
        headerClass: 'text-right',
        cellClass: 'text-right',
        valueFormatter: (value) => {
            if (value === undefined || value === null) return '-';
            return new Intl.NumberFormat('he-IL', {
                style: 'currency',
                currency: 'ILS',
                maximumFractionDigits: 0
            }).format(Number(value));
        },
        cellStyle: { fontWeight: 500 }
    },
    {
        field: "stock_quantity",
        headerName: "Stock",
        width: 120,
        cellRenderer: ({ data }) => {
            const stock = data.stock_quantity || 0;
            const minStock = data.min_stock || 10; // Default threshold
            const isLow = stock < minStock;

            return (
                <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${isLow ? 'text-red-600' : 'text-foreground'}`}>
                        {stock}
                    </span>
                    {isLow && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
                </div>
            );
        }
    },
    {
        field: "status",
        headerName: "Status",
        width: 120,
        cellRenderer: ({ value }) => {
            const status = String(value || 'ACTIVE').toUpperCase();
            let colorClass = "bg-secondary text-secondary-foreground";

            if (status === 'ACTIVE') colorClass = "bg-green-500/10 text-green-600 border border-green-500/20";
            else if (status === 'INACTIVE') colorClass = "bg-red-500/10 text-red-600 border border-red-500/20";
            else if (status === 'DISCONTINUED') colorClass = "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"; // Add discontinued

            return (
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${colorClass}`}>
                    {value || 'Active'}
                </span>
            );
        }
    },
    {
        field: "created_at",
        headerName: "Added",
        width: 140,
        valueFormatter: (value) => {
            if (!value) return '-';
            try { return formatDistanceToNow(new Date(String(value)), { addSuffix: true }); }
            catch { return '-'; }
        }
    }
];
