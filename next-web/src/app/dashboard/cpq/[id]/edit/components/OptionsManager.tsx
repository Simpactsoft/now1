"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, Edit, Trash2 } from "lucide-react";
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
import type { Option } from "@/app/actions/cpq/template-actions";
import { deleteOption, reorderOptions } from "@/app/actions/cpq/option-actions";
import { AddOptionDialog } from "./AddOptionDialog";

interface OptionsManagerProps {
    groupId: string;
    options: Option[];
    onUpdate: () => void;
}

function SortableOptionRow({
    option,
    onEdit,
    onDelete,
}: {
    option: Option;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [isDeleting, startDelete] = useTransition();

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: option.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleDelete = () => {
        if (!confirm(`Delete "${option.name}"?`)) {
            return;
        }

        startDelete(async () => {
            const result = await deleteOption(option.id);
            if (result.success) {
                toast.success("Option deleted");
                onDelete();
            } else {
                toast.error(result.error || "Failed to delete option");
            }
        });
    };

    // Format price modifier
    const formatPrice = () => {
        const value = option.priceModifierAmount;
        if (option.priceModifierType === "add") {
            return value >= 0 ? `+₪${value}` : `-₪${Math.abs(value)}`;
        } else if (option.priceModifierType === "multiply") {
            return `×${value}`;
        } else {
            return `₪${value}`;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 p-3 border rounded-lg bg-background hover:bg-muted/50"
        >
            {/* Drag Handle */}
            <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </button>

            {/* Image (if exists) */}
            {option.imageUrl && (
                <img
                    src={option.imageUrl}
                    alt={option.name}
                    className="h-10 w-10 object-cover rounded"
                />
            )}

            {/* Content */}
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    {option.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                            Default
                        </Badge>
                    )}
                </div>
                {option.description && (
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                )}
                {option.sku && (
                    <p className="text-xs text-muted-foreground">SKU: {option.sku}</p>
                )}
            </div>

            {/* Price */}
            <div className="text-sm font-semibold">{formatPrice()}</div>

            {/* Actions */}
            <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={onEdit} disabled={isDeleting}>
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
    );
}

export function OptionsManager({ groupId, options, onUpdate }: OptionsManagerProps) {
    const router = useRouter();
    const [items, setItems] = useState(options);
    const [isReordering, startReorder] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<Option | null>(null);

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

            // Save to DB
            startReorder(async () => {
                const result = await reorderOptions(
                    groupId,
                    newOrder.map((o) => o.id)
                );

                if (result.success) {
                    toast.success("Options reordered");
                    router.refresh();
                } else {
                    toast.error(result.error || "Failed to reorder options");
                    setItems(options); // Rollback
                }
            });
        }
    };

    // Sync local state when options prop updates (after router.refresh)
    useEffect(() => {
        setItems(options);
    }, [options]);

    const handleRefresh = () => {
        onUpdate();
        router.refresh();
    };

    const handleEdit = (option: Option) => {
        setEditingOption(option);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingOption(null);
    };

    // Empty state
    if (options.length === 0) {
        return (
            <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                    No options yet. Add options for users to choose from.
                </p>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-3 w-3 mr-2" />
                    Add First Option
                </Button>

                <AddOptionDialog
                    groupId={groupId}
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    onSuccess={handleRefresh}
                    editingOption={editingOption}
                />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                    {options.length} option{options.length !== 1 ? "s" : ""}
                </span>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-3 w-3 mr-2" />
                    Add Option
                </Button>
            </div>

            {/* Sortable List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {items.map((option) => (
                        <SortableOptionRow
                            key={option.id}
                            option={option}
                            onEdit={() => handleEdit(option)}
                            onDelete={handleRefresh}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            {/* Add/Edit Dialog */}
            <AddOptionDialog
                groupId={groupId}
                open={dialogOpen}
                onClose={handleCloseDialog}
                onSuccess={handleRefresh}
                editingOption={editingOption}
            />
        </div>
    );
}
