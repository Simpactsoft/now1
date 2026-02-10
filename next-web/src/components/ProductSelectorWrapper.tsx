
"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import { productColumns } from "@/components/products/productColumns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, AlertTriangle, Tag } from "lucide-react";
import { Product } from "@/types/product";
import { createBrowserClient } from "@supabase/ssr";
import ProductTags from "@/components/products/ProductTags";

interface ProductSelectorWrapperProps {
    tenantId: string;
    mode?: 'select' | 'manage';
    onProductSelect?: (product: Product) => void;
    initialSelectedIds?: string[]; // Visualization of selection
}

export default function ProductSelectorWrapper({
    tenantId,
    mode = 'manage',
    onProductSelect,
    initialSelectedIds = []
}: ProductSelectorWrapperProps) {

    const router = useRouter();

    // Filters Options
    const [categoryOptions, setCategoryOptions] = useState<any[]>([]);

    // Determine Supabase client for client-side fetches (categories)
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch Categories for Filter
    useEffect(() => {
        console.log('[ProductSelectorWrapper] tenantId:', tenantId);
        if (!tenantId) return;

        const fetchCategories = async () => {
            // Fetch from products categories table
            const { data, error } = await supabase
                .from('product_categories')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .order('name');

            console.log('[ProductSelectorWrapper] Categories fetched:', data?.length || 0);
            if (data) {
                setCategoryOptions(data.map(c => ({ value: c.id, label: c.name })));
            }
        };
        fetchCategories();
    }, [tenantId, supabase]);

    // ---- Server-Side Data Fetching ----
    const onFetchData = useCallback(async (params: FetchDataParams): Promise<FetchDataResult<Product>> => {
        console.log('[ProductSelectorWrapper] onFetchData called with:', { tenantId, params });

        const payload = {
            filters: params.filters,
            searchQuery: params.searchQuery,
            sorting: params.sorting,
            pagination: params.pagination,
            tenantId
        };

        try {
            console.log('[ProductSelectorWrapper] Calling /api/products with payload:', payload);
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            console.log('[ProductSelectorWrapper] API response:', { ok: res.ok, data: json.data?.length || 0, total: json.totalRecords });
            console.log('[ProductSelectorWrapper] First product:', json.data?.[0]);

            if (!res.ok) {
                throw new Error(json.error || 'Failed to fetch products');
            }

            const result = {
                data: json.data || [],
                totalRecords: json.totalRecords || 0,
                totalPages: json.totalPages || 0
            };
            console.log('[ProductSelectorWrapper] Returning result:', { dataLength: result.data.length, totalRecords: result.totalRecords });
            return result;
        } catch (e: any) {
            console.error('[ProductSelectorWrapper] Fetch error:', e);
            toast.error(e.message);
            return { data: [], totalRecords: 0, totalPages: 0 };
        }
    }, [tenantId]);

    const config = useEntityView<Product>({
        entityType: 'products',
        serverSide: true,
        debounceMs: 500,
        initialPageSize: 50,
        onFetchData,
        defaultViewMode: 'cards', // Changed from 'tags' to 'cards' since renderCards is implemented
    });

    // ---- Actions ----
    const handleProductClick = (product: Product) => {
        if (mode === 'select' && onProductSelect) {
            onProductSelect(product);
            toast.success(`Selected ${product.name}`);
        } else {
            router.push(`/dashboard/products/${product.id}`);
        }
    };

    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Search (Name/SKU)', icon: null },
        { id: 'list_price', label: 'Price', icon: null },
        { id: 'category_id', label: 'Category', icon: null },
        { id: 'status', label: 'Status', icon: null },
    ], []);

    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            maximumFractionDigits: 0
        }).format(value);
    }

    return (
        <EntityViewLayout
            title={mode === 'select' ? 'Select Products' : 'Products'}
            entityType="products"
            tenantId={tenantId}
            config={config}
            columns={productColumns}
            onRowClick={handleProductClick}
            availableViewModes={['tags', 'grid', 'cards']}
            availableFilters={availableFilters}
            filterOptions={{
                status: [
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'INACTIVE', label: 'Inactive' },
                    { value: 'DISCONTINUED', label: 'Discontinued' }
                ],
                category_id: categoryOptions
            }}
            customActions={
                mode === 'manage' && (
                    <button
                        onClick={() => router.push('/dashboard/products/new')}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        + New Product
                    </button>
                )
            }

            // Render Overrides
            renderTags={(props) => (
                <ProductTags
                    products={props.data}
                    loading={props.loading}
                    onProductClick={handleProductClick}
                />
            )}
            renderCards={(props) => (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 pb-24">
                    {props.data.map(product => {
                        const isLow = (product.stock_quantity || 0) < (product.min_stock || 10);
                        return (
                            <div
                                key={product.id}
                                onClick={() => handleProductClick(product)}
                                className="border rounded-xl p-4 hover:shadow-lg cursor-pointer transition-all bg-card flex flex-col gap-3 group"
                            >
                                <div className="aspect-square w-full bg-secondary/30 rounded-lg flex items-center justify-center overflow-hidden relative">
                                    {product.image_url ? (
                                        <img src={product.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    ) : (
                                        <Package className="w-12 h-12 text-muted-foreground/50" />
                                    )}
                                    {product.category_name && (
                                        <span className="absolute top-2 right-2 bg-background/80 backdrop-blur text-[10px] px-2 py-0.5 rounded-full font-medium">
                                            {product.category_name}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-bold text-foreground truncate" title={product.name}>{product.name}</h3>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                                        <div className={`text-xs font-bold ${isLow ? 'text-red-500' : 'text-green-600'}`}>
                                            {product.stock_quantity} in stock
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-2 border-t flex justify-between items-center">
                                    <span className="font-bold text-lg">{formatPrice(product.list_price)}</span>
                                    {mode === 'select' && (
                                        <div className="w-6 h-6 rounded-full border flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                                            +
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        />
    );
}
