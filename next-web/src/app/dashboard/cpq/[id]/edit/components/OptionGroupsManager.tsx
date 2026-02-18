"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, Edit, Trash2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { toast } from "sonner";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OptionGroup } from "@/app/actions/cpq/template-actions";
import {
    deleteOptionGroup,
    reorderOptionGroups,
} from "@/app/actions/cpq/option-group-actions";
import { AddOptionGroupDialog } from "./AddOptionGroupDialog";
import { OptionsManager } from "./OptionsManager";

interface OptionGroupsManagerProps {
    templateId: string;
    groups: OptionGroup[];
}

function SortableGroupCard({
    group,
    onEdit,
    onDelete,
}: {
    group: OptionGroup;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDeleting, startDelete] = useTransition();

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleDelete = () => {
        if (!confirm(`Delete "${group.name}"? This will also delete all options in this group.`)) {
            return;
        }

        startDelete(async () => {
            const result = await deleteOptionGroup(group.id);
            if (result.success) {
                toast.success("Option group deleted");
                onDelete();
            } else {
                toast.error(result.error || "Failed to delete group");
            }
        });
    };

    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
        <Card ref={setNodeRef} style={style} className="mb-3">
            <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <button
                        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-5 w-5" />
                    </button>

                    {/* Expand/Collapse (only for manual groups) */}
                    {group.sourceType === "manual" && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-all"
                            title={isExpanded ? "Collapse options" : "Expand options"}
                        >
                            <ChevronIcon className="h-4 w-4" />
                        </button>
                    )}

                    {/* Group Icon */}
                    {group.iconUrl && (
                        <img
                            src={group.iconUrl}
                            alt={group.name}
                            className="h-10 w-10 object-contain rounded-lg border bg-muted/30 p-0.5"
                        />
                    )}

                    {/* Content */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">{group.name}</CardTitle>

                            {/* Badges */}
                            {group.isRequired && (
                                <Badge variant="destructive" className="text-xs">
                                    Required
                                </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                                {group.selectionType === "single" ? "Single" : "Multiple"}
                            </Badge>
                            {group.sourceType === "category" ? (
                                <Badge variant="secondary" className="text-xs">
                                    Category: {group.sourceCategoryPath || "Unknown"}
                                </Badge>
                            ) : (
                                <Badge variant="default" className="text-xs">
                                    Manual ({group.options.length} options)
                                </Badge>
                            )}
                        </div>

                        {group.description && (
                            <CardDescription className="text-sm">
                                {group.description}
                            </CardDescription>
                        )}

                        {/* Selection constraints */}
                        {group.selectionType === "multiple" && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Min: {group.minSelections} | Max:{" "}
                                {group.maxSelections || "unlimited"}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEdit}
                            disabled={isDeleting}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {/* Nested Options Manager (only for manual groups when expanded) */}
            {group.sourceType === "manual" && isExpanded && (
                <CardContent className="pt-0 pl-12">
                    <OptionsManager
                        groupId={group.id}
                        options={group.options}
                        onUpdate={onDelete} // Reuse parent refresh
                    />
                </CardContent>
            )}
        </Card>
    );
}

export function OptionGroupsManager({ templateId, groups = [] }: OptionGroupsManagerProps) {
    const router = useRouter();
    const [items, setItems] = useState(groups);
    const [isReordering, startReorder] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            const newOrder = arrayMove(items, oldIndex, newIndex);
            setItems(newOrder);

            // Optimistic update - save to DB
            startReorder(async () => {
                const result = await reorderOptionGroups(
                    templateId,
                    newOrder.map((g) => g.id)
                );

                if (result.success) {
                    toast.success("Groups reordered");
                    router.refresh();
                } else {
                    toast.error(result.error || "Failed to reorder groups");
                    setItems(groups); // Rollback on error
                }
            });
        }
    };

    // Sync local state when groups prop updates (after router.refresh)
    useEffect(() => {
        setItems(groups);
    }, [groups]);

    const handleRefresh = () => {
        router.refresh();
    };

    const handleEdit = (group: OptionGroup) => {
        setEditingGroup(group);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingGroup(null);
    };

    // Empty state
    if (!groups || groups.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="mb-4 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No option groups yet</p>
                    <p className="text-xs mt-1">
                        Add groups to define what choices users can make
                    </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Group
                </Button>

                <AddOptionGroupDialog
                    templateId={templateId}
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    onSuccess={handleRefresh}
                    editingGroup={editingGroup}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Option Groups</h3>
                    <p className="text-sm text-muted-foreground">
                        Define the choices available to users
                    </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                </Button>
            </div>

            {/* Sortable List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={items.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                    {items.map((group) => (
                        <SortableGroupCard
                            key={group.id}
                            group={group}
                            onEdit={() => handleEdit(group)}
                            onDelete={handleRefresh}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            {/* Add/Edit Dialog */}
            <AddOptionGroupDialog
                templateId={templateId}
                open={dialogOpen}
                onClose={handleCloseDialog}
                onSuccess={handleRefresh}
                editingGroup={editingGroup}
            />
        </div>
    );
}
