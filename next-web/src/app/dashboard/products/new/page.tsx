import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProductForm from "@/components/products/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    if (!tenantId) {
        return (
            <div className="flex items-center justify-center flex-1 h-[calc(100vh-65px)]">
                <p>Please select a tenant</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <ProductForm tenantId={tenantId} />
        </div>
    );
}
