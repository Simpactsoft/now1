"use client";

import ProductCard from "@/components/products/ProductCard";
import { useRouter } from "next/navigation";

interface ProductCardWrapperProps {
    product: {
        id: string;
        sku: string;
        name: string;
        status?: string;
        cost_price?: number;
        list_price?: number;
        product_type?: string;
        track_inventory?: boolean;
        custom_fields?: Record<string, any>;
        is_configurable?: boolean;
        template_id?: string | null;
    };
    tenantId: string;
}

export default function ProductCardWrapper({ product, tenantId }: ProductCardWrapperProps) {
    const router = useRouter();

    const handleEdit = (id: string) => {
        // TODO: Open edit dialog or navigate to edit page
        console.log("Edit product:", id);
    };

    const handleDelete = async (id: string) => {
        // TODO: Implement delete functionality
        console.log("Delete product:", id);
        // After delete, redirect to products list
        // router.push('/dashboard/products');
    };

    const handleConfigure = (templateId: string) => {
        // Navigate to CPQ template editor
        router.push(`/dashboard/cpq/${templateId}/edit`);
    };

    return (
        <ProductCard
            product={product}
            tenantId={tenantId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onConfigure={product.is_configurable && product.template_id ? handleConfigure : undefined}
        />
    );
}
