"use client";

import { Package } from "lucide-react";
import { Product } from "@/types/product";

interface ProductTagsProps {
    products: Product[];
    loading: boolean;
    onProductClick: (product: Product) => void;
    highlightId?: string | null;
}

export default function ProductTags({
    products,
    loading,
    onProductClick,
    highlightId
}: ProductTagsProps) {
    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading products...</div>;
    }

    if (!products.length) {
        return <div className="p-4 text-sm text-muted-foreground">No products found.</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-3">
            <div className="flex flex-wrap gap-3">
                {products.map((product) => (
                    <ProductPill
                        key={product.id}
                        product={product}
                        highlightId={highlightId}
                        onProductClick={onProductClick}
                    />
                ))}
            </div>
        </div>
    );
}

function ProductPill({
    product,
    highlightId,
    onProductClick
}: {
    product: Product;
    highlightId?: string | null;
    onProductClick: (product: Product) => void;
}) {
    const isHighlighted = highlightId === product.id;
    const isOutOfStock = product.track_inventory && (product.stock_quantity || 0) === 0;
    const isLowStock = product.track_inventory && (product.stock_quantity || 0) < (product.min_stock || 10) && !isOutOfStock;

    const getStatusColor = () => {
        if (isOutOfStock) {
            return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
        }
        if (isLowStock) {
            return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
        }
        if (product.status === 'INACTIVE') {
            return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
        }
        if (product.status === 'DISCONTINUED') {
            return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
        }
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    };

    return (
        <div
            onClick={() => onProductClick(product)}
            className={`
                group flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200 cursor-pointer
                hover:shadow-md hover:scale-105 active:scale-95
                ${getStatusColor()}
                ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}
            `}
            title={`${product.name} - ${product.sku || 'No SKU'}`}
        >
            {/* Product Icon */}
            <div className="w-6 h-6 rounded-full overflow-hidden bg-white/20 flex-shrink-0 flex items-center justify-center">
                {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Package className="w-4 h-4 opacity-80" />
                )}
            </div>

            {/* Name */}
            <span className="text-sm font-semibold truncate max-w-[150px]">
                {product.name}
            </span>

            {/* Price Badge */}
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/30 dark:bg-black/20">
                ₪{product.list_price?.toLocaleString()}
            </span>
        </div>
    );
}
