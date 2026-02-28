"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModules } from "@/context/ModulesContext";
import { toast } from "sonner";

/**
 * Maps route prefixes to module keys.
 * If a user navigates to a route whose module is disabled, they are redirected.
 */
const ROUTE_MODULE_MAP: Record<string, string> = {
    "/dashboard/people": "people",
    "/dashboard/tasks": "tasks",
    "/dashboard/import": "import_data",
    "/dashboard/organizations": "organizations",
    "/dashboard/relationships": "relationships",
    "/dashboard/products": "products",
    "/dashboard/cpq": "cpq",
    "/dashboard/sales/leads": "leads",
    "/dashboard/sales/pipelines": "pipelines",
    "/dashboard/sales/quotes": "quotes",
    "/dashboard/commissions": "commissions",
    "/dashboard/purchase-orders": "purchase_orders",
    "/dashboard/payments": "payments",
};

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isModuleEnabled, loaded } = useModules();

    useEffect(() => {
        if (!loaded || !pathname) return;

        // Check if current route matches a protected module
        for (const [routePrefix, moduleKey] of Object.entries(ROUTE_MODULE_MAP)) {
            if (pathname === routePrefix || pathname.startsWith(routePrefix + "/")) {
                if (!isModuleEnabled(moduleKey)) {
                    toast.error("מודול זה אינו זמין עבור הדייר שלך");
                    router.replace("/dashboard");
                    return;
                }
                break;
            }
        }
    }, [pathname, loaded, isModuleEnabled, router]);

    return <>{children}</>;
}
