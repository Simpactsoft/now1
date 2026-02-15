"use client";

import { useState, useEffect } from "react";
import { Package, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Product {
    id: string;
    name: string;
    sku: string;
    price: number;
}

interface CategoryProductPreviewProps {
    categoryId: string | null;
}

export function CategoryProductPreview({
    categoryId,
}: CategoryProductPreviewProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!categoryId) {
            setProducts([]);
            return;
        }

        async function fetchProducts() {
            setIsLoading(true);
            try {
                // TODO: Replace with actual API call to get_group_options or similar
                // For now, return mock data
                await new Promise((resolve) => setTimeout(resolve, 500));

                const mockProducts: Product[] = [
                    {
                        id: "1",
                        name: "Sample Product 1",
                        sku: "SKU-001",
                        price: 999.99,
                    },
                    {
                        id: "2",
                        name: "Sample Product 2",
                        sku: "SKU-002",
                        price: 1299.99,
                    },
                ];
                setProducts(mockProducts);
            } catch (error) {
                console.error("Failed to fetch products:", error);
                setProducts([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchProducts();
    }, [categoryId]);

    if (!categoryId) {
        return (
            <div className="text-xs text-muted-foreground p-3 border rounded-md bg-muted/20">
                Select a category to preview products
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                    Loading products...
                </span>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center p-4 border rounded-md bg-muted/20">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                    No products found in this category
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-md">
            <div className="p-2 border-b bg-muted/30">
                <p className="text-xs font-medium">
                    Products in category ({products.length})
                </p>
                <p className="text-xs text-muted-foreground">
                    These products will be available as options
                </p>
            </div>
            <ScrollArea className="h-[150px]">
                <div className="p-2 space-y-1">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    SKU: {product.sku}
                                </p>
                            </div>
                            <div className="text-sm font-medium ml-2">
                                ₪{product.price.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
