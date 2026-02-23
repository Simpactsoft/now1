import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TasksHubClient } from "./TasksHubClient";

export default async function TasksPage() {
    const supabase = await createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
        redirect("/login");
    }

    const userId = userData.user.id;

    // Fetch the first assigned tenant for the user
    const { data: member } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", userId)
        .limit(1)
        .single();

    const tenantId = member?.tenant_id;

    if (!tenantId) {
        return <div className="p-8">Tenant not found or unauthorized.</div>;
    }

    // Fetch assigned tasks open matching the user
    // Note: The UI can filter open/completed, so we fetch all tasks assigned to the user
    const { data: tasks, error } = await supabase
        .from("activities")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_task", true)
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to load tasks", error);
        return <div className="p-8">Failed to load tasks.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <TasksHubClient
                initialTasks={tasks || []}
                tenantId={tenantId}
                userId={userId}
            />
        </div>
    );
}
