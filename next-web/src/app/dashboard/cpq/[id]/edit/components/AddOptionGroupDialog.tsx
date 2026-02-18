"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { OptionGroup } from "@/app/actions/cpq/template-actions";
import {
    createOptionGroup,
    updateOptionGroup,
} from "@/app/actions/cpq/option-group-actions";
import { CategoryTreePicker } from "@/components/cpq/CategoryTreePicker";
import { CategoryProductPreview } from "@/components/cpq/CategoryProductPreview";

interface AddOptionGroupDialogProps {
    templateId: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingGroup: OptionGroup | null;
}

export function AddOptionGroupDialog({
    templateId,
    open,
    onClose,
    onSuccess,
    editingGroup,
}: AddOptionGroupDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form state
    const [name, setName] = useState(editingGroup?.name || "");
    const [description, setDescription] = useState(editingGroup?.description || "");
    const [selectionType, setSelectionType] = useState<"single" | "multiple">(
        editingGroup?.selectionType || "single"
    );
    const [isRequired, setIsRequired] = useState(editingGroup?.isRequired || false);
    const [minSelections, setMinSelections] = useState(
        editingGroup?.minSelections?.toString() || "0"
    );
    const [maxSelections, setMaxSelections] = useState(
        editingGroup?.maxSelections?.toString() || ""
    );
    const [sourceType, setSourceType] = useState<"manual" | "category">(
        editingGroup?.sourceType || "manual"
    );
    const [sourceCategoryId, setSourceCategoryId] = useState(
        editingGroup?.sourceCategoryId || ""
    );
    const [sourceCategoryPath, setSourceCategoryPath] = useState("");
    const [iconUrl, setIconUrl] = useState(editingGroup?.iconUrl || "");

    // Reset form when dialog opens/closes or editingGroup changes
    useEffect(() => {
        if (editingGroup) {
            setName(editingGroup.name);
            setDescription(editingGroup.description || "");
            setSelectionType(editingGroup.selectionType);
            setIsRequired(editingGroup.isRequired);
            setMinSelections(editingGroup.minSelections.toString());
            setMaxSelections(editingGroup.maxSelections?.toString() || "");
            setSourceType(editingGroup.sourceType);
            setSourceCategoryId(editingGroup.sourceCategoryId || "");
            setIconUrl(editingGroup.iconUrl || "");
        } else {
            setName("");
            setDescription("");
            setSelectionType("single");
            setIsRequired(false);
            setMinSelections("0");
            setMaxSelections("");
            setSourceType("manual");
            setSourceCategoryId("");
            setIconUrl("");
        }
    }, [editingGroup, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        if (sourceType === "category" && !sourceCategoryId) {
            toast.error("Please select a category");
            return;
        }

        if (selectionType === "multiple") {
            const min = parseInt(minSelections);
            const max = maxSelections ? parseInt(maxSelections) : null;

            if (max !== null && min > max) {
                toast.error("Min selections cannot be greater than max");
                return;
            }
        }

        startTransition(async () => {
            const params = {
                name: name.trim(),
                description: description.trim() || undefined,
                selectionType,
                isRequired,
                minSelections:
                    selectionType === "multiple" ? parseInt(minSelections) : 0,
                maxSelections:
                    selectionType === "multiple" && maxSelections
                        ? parseInt(maxSelections)
                        : undefined,
                sourceType,
                sourceCategoryId: sourceType === "category" ? sourceCategoryId : null,
                categoryPriceMode: sourceType === "category" ? "list_price" : undefined,
                iconUrl: iconUrl.trim() || undefined,
            };

            const result = editingGroup
                ? await updateOptionGroup(editingGroup.id, params)
                : await createOptionGroup(templateId, params);

            if (result.success) {
                toast.success(editingGroup ? "Group updated" : "Group created");
                onSuccess();
                onClose();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to save group");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {editingGroup ? "Edit Option Group" : "Add Option Group"}
                    </DialogTitle>
                    <DialogDescription>
                        Define a category of choices for this template
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <Label htmlFor="name">
                            Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Size, Color, Accessories"
                            disabled={isPending}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description for users"
                            rows={2}
                            disabled={isPending}
                        />
                    </div>

                    {/* Source Type */}
                    <div>
                        <Label>Source Type</Label>
                        <Select
                            value={sourceType}
                            onValueChange={(value: "manual" | "category") =>
                                setSourceType(value)
                            }
                            disabled={isPending}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual (Custom options)</SelectItem>
                                <SelectItem value="category">
                                    Category (Auto-populated from catalog)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {sourceType === "manual"
                                ? "You'll define options manually"
                                : "Options will come from products in a category"}
                        </p>
                    </div>

                    {/* Category Selector (only if category source) */}
                    {sourceType === "category" && (
                        <div className="space-y-3">
                            <div>
                                <Label>
                                    Category <span className="text-destructive">*</span>
                                </Label>
                                <CategoryTreePicker
                                    value={sourceCategoryId}
                                    onChange={(categoryId, categoryPath) => {
                                        setSourceCategoryId(categoryId);
                                        setSourceCategoryPath(categoryPath);
                                    }}
                                />
                            </div>
                            <CategoryProductPreview categoryId={sourceCategoryId || null} />
                        </div>
                    )}

                    {/* Selection Type */}
                    <div>
                        <Label>Selection Type</Label>
                        <Select
                            value={selectionType}
                            onValueChange={(value: "single" | "multiple") =>
                                setSelectionType(value)
                            }
                            disabled={isPending}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="single">Single (Pick one)</SelectItem>
                                <SelectItem value="multiple">
                                    Multiple (Pick many)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Min/Max Selections (only if multiple) */}
                    {selectionType === "multiple" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="min">Min Selections</Label>
                                <Input
                                    id="min"
                                    type="number"
                                    min="0"
                                    value={minSelections}
                                    onChange={(e) => setMinSelections(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                            <div>
                                <Label htmlFor="max">Max Selections</Label>
                                <Input
                                    id="max"
                                    type="number"
                                    min="1"
                                    value={maxSelections}
                                    onChange={(e) => setMaxSelections(e.target.value)}
                                    placeholder="Unlimited"
                                    disabled={isPending}
                                />
                            </div>
                        </div>
                    )}

                    {/* Is Required */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="required">Required</Label>
                            <p className="text-xs text-muted-foreground">
                                Users must make a selection
                            </p>
                        </div>
                        <Switch
                            id="required"
                            checked={isRequired}
                            onCheckedChange={setIsRequired}
                            disabled={isPending}
                        />
                    </div>

                    {/* Group Icon/Image */}
                    <div className="space-y-2">
                        <Label htmlFor="iconUrl">Group Image / Icon</Label>
                        <Input
                            id="iconUrl"
                            type="url"
                            value={iconUrl}
                            onChange={(e) => setIconUrl(e.target.value)}
                            placeholder="https://example.com/icon.png"
                            disabled={isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                            Optional image shown next to the group name in the configurator
                        </p>
                        {iconUrl ? (
                            <div className="mt-1 inline-flex rounded-lg border overflow-hidden bg-muted/30 p-1">
                                <img
                                    src={iconUrl}
                                    alt="Group icon"
                                    className="h-16 w-16 object-contain rounded"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="mt-1 inline-flex items-center justify-center h-16 w-16 rounded-lg border-2 border-dashed bg-muted/20">
                                <ImageIcon className="h-6 w-6 text-muted-foreground opacity-30" />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingGroup ? "Update Group" : "Create Group"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
