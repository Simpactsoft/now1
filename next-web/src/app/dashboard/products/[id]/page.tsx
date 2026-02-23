import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ProductCardWrapper from "@/components/products/ProductCardWrapper";
import ProductVariantsPanel from "@/components/products/ProductVariantsPanel";
import ProductRelationshipsClient from "@/components/products/ProductRelationshipsClient";
import BomTab from "@/components/products/BomTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

    // Fetch product details from cards view (products is a view)
    const { data: product, error } = await supabase
        .from("products")
        .select(`
            *,
            is_configurable,
            template_id
        `)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();

    if (error || !product) {
        notFound();
    }

    // Transform product data to match ProductCard interface
    const productData = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        status: product.status,
        cost_price: product.cost_price,
        list_price: product.list_price,
        product_type: product.product_type,
        track_inventory: product.track_inventory,
        custom_fields: product.custom_fields || {},
        is_configurable: product.is_configurable || false,
        template_id: product.template_id || null,
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold mb-4">{product.name}</h1>

            <Tabs defaultValue="edit" className="w-full" dir="rtl">
                <TabsList className="mb-4">
                    <TabsTrigger value="edit">עריכת מוצר</TabsTrigger>
                    <TabsTrigger value="bom">הצג בום</TabsTrigger>
                    <TabsTrigger value="inventory">היסטורית מלאי</TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-6 mt-0">
                    <ProductCardWrapper
                        product={productData}
                        tenantId={tenantId}
                    />

                    {/* Product Variants Section */}
                    <ProductVariantsPanel
                        tenantId={tenantId}
                        productId={id}
                        productName={product.name}
                    />

                    {/* AI Relationships Section */}
                    <ProductRelationshipsClient
                        tenantId={tenantId}
                        productId={id}
                        productName={product.name}
                    />
                </TabsContent>

                <TabsContent value="bom" className="mt-0">
                    <BomTab
                        productId={id}
                        productName={product.name}
                    />
                </TabsContent>

                <TabsContent value="inventory" className="mt-0">
                    <div className="p-12 text-center bg-card border border-border rounded-lg text-muted-foreground">
                        <p>היסטורית מלאי תתווסף בקרוב לשירות...</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
