import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { fetchPipelines, fetchPipelineStages, fetchOpportunities } from "@/app/actions/pipeline-actions";
import { PipelineViewClient } from "./PipelineViewClient";

import { cookies } from "next/headers";

export const metadata = {
    title: 'Pipelines | CRM',
};

export default async function PipelinesPage(props: { searchParams: Promise<{ pipelineId?: string }> }) {
    const searchParams = await props.searchParams;
    const userRes = await getCurrentUser();
    if (!userRes || !userRes.success || !userRes.data) redirect("/login");

    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;

    if (!tenantId) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-background">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold">No Active Organization</h2>
                    <p className="text-muted-foreground">Please select an organization to view pipelines.</p>
                </div>
            </div>
        );
    }

    // Fetch all pipelines for dropdown
    const pipelinesRes = await fetchPipelines(tenantId);
    const pipelines = pipelinesRes.data || [];

    if (pipelines.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-background">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold">No Pipelines Found</h2>
                    <p className="text-muted-foreground">Please run the CRM seed script to create default pipelines.</p>
                </div>
            </div>
        );
    }

    // Default to the first pipeline if none specified
    const activePipelineId = searchParams.pipelineId || pipelines[0].id;
    const activePipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];

    // Fetch stages for the active pipeline
    const stagesRes = await fetchPipelineStages(tenantId, activePipeline.id);
    const stages = stagesRes.data || [];

    // Fetch opportunities
    const opportunitiesRes = await fetchOpportunities(tenantId, activePipeline.id);
    const opportunities = opportunitiesRes.data || [];

    return (
        <div className="h-[calc(100vh-100px)] lg:h-[calc(100vh-64px)] w-full flex flex-col p-6 space-y-6 overflow-hidden min-h-0 min-w-0">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
                    <p className="text-muted-foreground">Manage your sales opportunities and workflows visually.</p>
                </div>
                {/* We'll add a 'New Opportunity' button inside the Client Component */}
            </div>

            <PipelineViewClient
                tenantId={tenantId}
                pipelines={pipelines}
                activePipeline={activePipeline}
                stages={stages}
                initialOpportunities={opportunities}
            />
        </div>
    );
}
