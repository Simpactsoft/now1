
import UserManagement from "@/components/UserManagement";
import { cookies } from "next/headers";

export const metadata = {
    title: "Team Management | NOW System",
};

export default async function TeamPage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto p-6">
            <header className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Settings</h1>
                <p className="text-muted-foreground text-sm">Review, add, and manage your team members.</p>
            </header>

            <UserManagement tenantId={tenantId} />
        </div>
    );
}
