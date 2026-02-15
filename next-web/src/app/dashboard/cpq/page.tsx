import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CPQPageWrapper from "@/components/cpq/CPQPageWrapper";

export default async function CPQPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    // Read tenant_id from cookie (like Quote Builder)
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value || null;

    return <CPQPageWrapper tenantId={tenantId} />;
}
