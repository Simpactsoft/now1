
import { cookies } from "next/headers";
import PeopleViewWrapper from "@/components/PeopleViewWrapper";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "CRM Contacts | NOW System",
    description: "Manage all people and prospects",
};

export default async function PeoplePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    return (
        <div className="h-[calc(100vh-65px)] w-full bg-background flex flex-col overflow-hidden">
            {!tenantId ? (
                <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-muted-foreground font-medium">Please select a tenant to view contacts</p>
                </div>
            ) : (
                <PeopleViewWrapper tenantId={tenantId} />
            )}
        </div>
    );
}
