import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import ConfigurationsPageWrapper from "@/components/cpq/ConfigurationsPageWrapper";
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/tenant";

export default async function ConfigurationsPage() {
    const user = await getCurrentUser();

    if (!user || !user.success || !user.data) {
        redirect('/login');
    }

    const actualUser = user.data;

    // Admin users can have null tenant_id (they see all tenants)
    // Regular users need a tenant_id
    const supabase = await createClient();
    const tenantId = await getTenantId(actualUser, supabase);

    return <ConfigurationsPageWrapper tenantId={tenantId} />;
}
