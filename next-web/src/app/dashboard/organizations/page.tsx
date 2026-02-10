
import { createClient } from "@/lib/supabase/server";
import OrganizationViewWrapper from "@/components/OrganizationViewWrapper";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function OrganizationsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Role Check (Optional - currently open to all logged in users)
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const cookieStore = await cookies();
    const cookieTenantId = cookieStore.get("tenant_id")?.value;

    // Priority: Cookie (Session) > Profile (Default) > User ID (Fallback)
    const activeTenantId = cookieTenantId || profile?.tenant_id || user.id;

    return (
        <div className="h-[calc(100vh-65px)] w-full bg-background flex flex-col overflow-hidden">
            <OrganizationViewWrapper
                user={user}
                tenantId={activeTenantId}
            />
        </div>
    );
}

