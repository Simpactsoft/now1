"use client";

import { useState, useEffect } from "react";
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy
} from "@dnd-kit/sortable";
import { updateOpportunityStage } from "@/app/actions/pipeline-actions";
import { toast } from "sonner";
import { PipelineColumn } from "./PipelineColumn";
import { OpportunityCard } from "./OpportunityCard";

export function PipelineViewClient({ tenantId, pipelines, activePipeline, stages, initialOpportunities }: any) {
    const [opportunities, setOpportunities] = useState(initialOpportunities || []);
    const [activeId, setActiveId] = useState<string | null>(null);

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeOpportunityId = active.id as string;
        // The over id will be either a stageId (dropping on empty column) or another opportunityId
        const overId = over.id as string;

        // Find what stage we are dropping into
        const isOverStage = stages.some((s: any) => s.id === overId);

        let targetStageId = overId;

        if (!isOverStage) {
            // Find the opportunity we dropped over to get its stage
            const overOpp = opportunities.find((o: any) => o.id === overId);
            if (overOpp) {
                targetStageId = overOpp.stage_id;
            }
        }

        const activeOpp = opportunities.find((o: any) => o.id === activeOpportunityId);
        if (!activeOpp || activeOpp.stage_id === targetStageId) return; // Didn't move stages

        // Optimistic UI Update
        setOpportunities((prev: any) =>
            prev.map((opp: any) =>
                opp.id === activeOpportunityId
                    ? { ...opp, stage_id: targetStageId }
                    : opp
            )
        );

        // Server Update
        const res = await updateOpportunityStage(tenantId, activeOpportunityId, targetStageId);
        if (!res.success) {
            toast.error("Failed to update opportunity stage");
            // Revert changes
            setOpportunities(initialOpportunities);
        } else {
            toast.success("Stage updated safely!");
        }
    };

    // Filter opportunities by stage
    const getOpportunitiesByStage = (stageId: string) => {
        return opportunities.filter((opp: any) => opp.stage_id === stageId);
    };

    const activeOpp = activeId ? opportunities.find((o: any) => o.id === activeId) : null;

    return (
        <div className="flex-1 flex flex-col space-y-4 min-h-0">
            {/* Toolbar */}
            <div className="flex items-center space-x-4 pb-4">
                {/* Pipeline Select Placeholder */}
                <div className="bg-muted px-4 py-2 rounded-md font-medium text-sm border">
                    {activePipeline?.name}
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-auto pb-6 w-full h-full relative custom-scrollbar">
                {isMounted ? (
                    <DndContext
                        id="pipeline-kanban-dnd-context"
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex space-x-4 h-full min-w-max items-start pb-2">
                            {stages.map((stage: any) => (
                                <PipelineColumn
                                    key={stage.id}
                                    stage={stage}
                                    opportunities={getOpportunitiesByStage(stage.id)}
                                />
                            ))}
                        </div>

                        <DragOverlay>
                            {activeOpp ? <OpportunityCard opportunity={activeOpp} isDragging /> : null}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div className="flex space-x-4 h-full min-w-max items-start pb-2">
                        {stages.map((stage: any) => (
                            <PipelineColumn
                                key={stage.id}
                                stage={stage}
                                opportunities={getOpportunitiesByStage(stage.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
