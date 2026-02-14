import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import ConfigurationsPageWrapper from "@/components/cpq/ConfigurationsPageWrapper";

export default async function ConfigurationsPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    // Admin users can have null tenant_id (they see all tenants)
    // Regular users need a tenant_id
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id || null;

    return <ConfigurationsPageWrapper tenantId={tenantId} />;
}
