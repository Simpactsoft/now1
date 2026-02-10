import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ProductActions from "@/components/products/ProductActions";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    if (!tenantId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Please select a tenant</p>
            </div>
        );
    }

    // Fetch product details
    const { data: product, error } = await supabase
        .from("products")
        .select(`
            *,
            categories:product_categories(id, name)
        `)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !product) {
        notFound();
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">{product.name}</h1>
                <p className="text-muted-foreground">SKU: {product.sku}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Image */}
                <div className="bg-secondary/30 rounded-lg aspect-square flex items-center justify-center">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-lg"
                        />
                    ) : (
                        <div className="text-muted-foreground">No image</div>
                    )}
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                        <h2 className="text-lg font-semibold mb-3">Pricing</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Cost Price:</span>
                                <span className="font-medium">₪{product.cost_price?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">List Price:</span>
                                <span className="font-bold text-lg">₪{product.list_price?.toLocaleString()}</span>
                            </div>
                            {product.cost_price && product.list_price && (
                                <div className="flex justify-between pt-2 border-t">
                                    <span className="text-muted-foreground">Margin:</span>
                                    <span className="font-medium text-green-600">
                                        {((product.list_price - product.cost_price) / product.list_price * 100).toFixed(1)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-4">
                        <h2 className="text-lg font-semibold mb-3">Inventory</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Track Inventory:</span>
                                <span>{product.track_inventory ? 'Yes' : 'No'}</span>
                            </div>
                            {product.track_inventory && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Min Stock:</span>
                                        <span>{product.min_stock || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Max Stock:</span>
                                        <span>{product.max_stock || 'N/A'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-4">
                        <h2 className="text-lg font-semibold mb-3">Details</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category:</span>
                                <span>{product.categories?.name || 'Uncategorized'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className={`px-2 py-1 rounded text-xs ${product.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    product.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    }`}>
                                    {product.status}
                                </span>
                            </div>
                            {product.unit && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Unit:</span>
                                    <span>{product.unit}</span>
                                </div>
                            )}
                            {product.barcode && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Barcode:</span>
                                    <span className="font-mono text-sm">{product.barcode}</span>
                                </div>
                            )}
                            {product.tags && product.tags.length > 0 && (
                                <div className="flex justify-between items-start">
                                    <span className="text-muted-foreground">Tags:</span>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                        {product.tags.map((tag: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {product.description && (
                        <div className="bg-card border border-border rounded-lg p-4">
                            <h2 className="text-lg font-semibold mb-3">Description</h2>
                            <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <h2 className="text-lg font-semibold mb-3">Metadata</h2>
                        <div className="space-y-2 text-xs">
                            {product.created_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created:</span>
                                    <span>{new Date(product.created_at).toLocaleString('he-IL')}</span>
                                </div>
                            )}
                            {product.updated_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Updated:</span>
                                    <span>{new Date(product.updated_at).toLocaleString('he-IL')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <ProductActions productId={product.id} productName={product.name} />
        </div>
    );
}
