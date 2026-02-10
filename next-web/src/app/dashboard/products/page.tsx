
import { cookies } from "next/headers";
import ProductSelectorWrapper from "@/components/ProductSelectorWrapper";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    return (
        <div className="h-[calc(100vh-65px)] w-full bg-background flex flex-col overflow-auto">
            {!tenantId ? (
                <div className="flex items-center justify-center flex-1">
                    <p>Please select a tenant</p>
                </div>
            ) : (
                <ProductSelectorWrapper tenantId={tenantId} mode="manage" />
            )}
        </div>
    );
}
