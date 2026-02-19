"use client";

import { useState, useMemo, useEffect } from "react";
import EntityViewLayout from "@/components/EntityViewLayout";
import { useViewConfig } from "@/components/universal/ViewConfigContext";
import ProductsAgGrid from "./ProductsAgGrid";
import ProductTags from "./ProductTags";
import ConfigurationsList from "./ConfigurationsList";
import { Package, Plus, X, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Configuration } from "@/app/actions/cpq/configuration-actions";

interface Product {
    id: string;
    name: string;
    price: number;
    currency: string;
    category?: { id: string; name: string };
    sku?: string;
    stock_quantity: number;
    description?: string;
    [key: string]: any;
}

interface ProductSelectorProps {
    products: Product[];
    categories: { id: string; name: string }[];
    loading: boolean;
    onAddToQuote: (product: Product) => void | Promise<void>;
    onAddConfiguration: (configuration: Configuration) => void; // NEW: Handle configurations
    onRefresh: () => void;
}

export default function ProductSelector({ products, categories, loading, onAddToQuote, onAddConfiguration, onRefresh }: ProductSelectorProps) {
    const { searchTerm, viewMode, filters } = useViewConfig();

    // -- Filtering Logic --
    const filteredProducts = useMemo(() => {
        let res = products;

        // 1. Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.sku?.toLowerCase().includes(lower) ||
                p.category?.name.toLowerCase().includes(lower)
            );
        }

        // 2. Filters
        filters.forEach(filter => {
            if (!filter.isEnabled) return;

            if (filter.field === 'category') {
                // Category filter (multi-select logic if comma separated, or single)
                const selectedIds = filter.value.split(',').map(s => s.trim().toLowerCase());
                if (selectedIds.length > 0 && selectedIds[0] !== '') {
                    res = res.filter(p => {
                        const catId = p.category_id || p.category?.id;
                        // Check if category name or ID matches (SmartChip usually passes value)
                        // Assuming SmartChip passes ID or Name depending on config.
                        // Let's match against ID effectively if possible, or Name.
                        // For now, let's assume filter.value is the ID or Name.
                        return selectedIds.includes(catId?.toLowerCase() || '') ||
                            selectedIds.includes(p.category?.name.toLowerCase() || '');
                    });
                }
            }
        });

        return res;
    }, [products, searchTerm, filters]);

    // -- Render Views --

    const renderGrid = () => (
        <div className="h-[600px] w-full">
            <ProductsAgGrid
                products={filteredProducts}
                loading={loading}
                onAddToQuote={onAddToQuote}
                className="h-full w-full"
            />
        </div>
    );

    const renderCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 p-4 pb-20 overflow-y-auto h-[600px]">
            {filteredProducts.map(product => {
                const isOutOfStock = product.stock_quantity <= 0;
                return (
                    <div
                        key={product.id}
                        onClick={() => !isOutOfStock && onAddToQuote(product)}
                        className={cn(
                            "group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 bg-card hover:shadow-md cursor-pointer",
                            isOutOfStock ? "opacity-60 grayscale cursor-not-allowed" : "hover:border-primary/50"
                        )}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-secondary rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Package className="w-5 h-5" />
                            </div>
                            {isOutOfStock && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                    Out of Stock
                                </span>
                            )}
                        </div>

                        <div className="space-y-1 mb-3">
                            <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                {product.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{product.sku || 'No SKU'}</span>
                                {product.category && (
                                    <>
                                        <span>•</span>
                                        <span>{product.category.name}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                            <div className="font-bold text-lg">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency || 'USD' }).format(product.price)}
                            </div>
                            {!isOutOfStock && (
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {filteredProducts.length === 0 && !loading && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mb-3 opacity-20" />
                    <p>No products found</p>
                </div>
            )}
        </div>
    );

    const renderTags = () => (
        <ProductTags
            products={filteredProducts}
            loading={loading}
            onAddToQuote={onAddToQuote}
        />
    );

    // NEW: Render Configurations Tab
    const renderConfigurations = () => (
        <ConfigurationsList
            onAddToQuote={onAddConfiguration}
            loading={loading}
        />
    );

    // Map categories for SmartChip options
    const categoryOptions = useMemo(() => {
        return categories.map(c => ({ value: c.id, label: c.name }));
    }, [categories]);

    return (
        <EntityViewLayout
            tenantId="App"
            totalCount={products.length}
            filteredCount={filteredProducts.length}
            lastRefreshed={new Date()}
            loading={loading}
            onRefresh={onRefresh}
            renderGrid={renderGrid}
            renderCards={renderCards}
            renderTags={renderTags}
            renderConfigurations={renderConfigurations}
            availableFilters={[
                { id: 'category', label: 'Category', icon: Package }
            ]}
            filterOptions={{
                category: categoryOptions
            }}
        />
    );
}
