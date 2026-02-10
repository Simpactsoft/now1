import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";

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
        .select("*")
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
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <ProductCard
                product={productData}
                tenantId={tenantId}
                onEdit={(id) => {
                    // TODO: Implement edit functionality
                    console.log("Edit product:", id);
                }}
                onDelete={(id) => {
                    // TODO: Implement delete functionality
                    console.log("Delete product:", id);
                }}
            />
        </div>
    );
}
