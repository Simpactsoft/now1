"use client";

import { Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    category?: { name: string };
    sku?: string;
    stock_quantity: number;
    [key: string]: any;
}

interface ProductTagsProps {
    products: Product[];
    loading: boolean;
    onAddToQuote: (product: Product) => void;
}

export default function ProductTags({ products, loading, onAddToQuote }: ProductTagsProps) {
    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading products...</div>;
    }

    if (!products.length) {
        return <div className="p-4 text-sm text-muted-foreground">No products found.</div>;
    }

    return (
        <div className="flex flex-wrap gap-2 p-4 content-start overflow-y-auto h-full min-h-[400px]">
            {products.map((product) => (
                <ProductTag
                    key={product.id}
                    product={product}
                    onAddToQuote={onAddToQuote}
                />
            ))}
        </div>
    );
}

function ProductTag({ product, onAddToQuote }: { product: Product, onAddToQuote: (product: Product) => void }) {
    const isOutOfStock = product.stock_quantity <= 0;

    return (
        <div
            onClick={() => !isOutOfStock && onAddToQuote(product)}
            className={cn(
                "group relative flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border transition-all duration-200 cursor-pointer bg-card hover:shadow-sm select-none",
                isOutOfStock
                    ? "opacity-60 grayscale border-dashed cursor-not-allowed bg-muted/30"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
            )}
            title={product.description || product.name}
        >
            <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                isOutOfStock ? "bg-muted text-muted-foreground" : "bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground"
            )}>
                <Package size={12} />
            </div>

            <div className="flex flex-col leading-none">
                <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                    {product.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency || 'USD' }).format(product.price)}
                </span>
            </div>

            {!isOutOfStock && (
                <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={12} className="text-primary" />
                </div>
            )}
        </div>
    );
}
