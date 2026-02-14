import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import CPQPageWrapper from "@/components/cpq/CPQPageWrapper";

export default async function CPQPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    // Admin users can have null tenant_id (they see all tenants)
    // Regular users need a tenant_id
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id || null;

    return <CPQPageWrapper tenantId={tenantId} />;
}
