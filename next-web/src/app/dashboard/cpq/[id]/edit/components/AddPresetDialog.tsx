"use client";

import { useState, useTransition, useEffect } from "react";
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
import { Loader2, Package } from "lucide-react";
import type { TemplatePreset, OptionGroup } from "@/app/actions/cpq/template-actions";
import { createPreset, updatePreset } from "@/app/actions/cpq/preset-actions";

interface AddPresetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templateId: string;
    optionGroups: OptionGroup[];
    editingPreset: TemplatePreset | null;
    onSuccess: () => void;
}

export function AddPresetDialog({
    open,
    onOpenChange,
    templateId,
    optionGroups,
    editingPreset,
    onSuccess,
}: AddPresetDialogProps) {
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [badgeText, setBadgeText] = useState("");
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

    // Populate form when editing
    useEffect(() => {
        if (editingPreset) {
            setName(editingPreset.name);
            setDescription(editingPreset.description || "");
            setBadgeText(editingPreset.badgeText || "");
            setSelectedOptions({ ...editingPreset.selectedOptions });
        } else {
            resetForm();
        }
    }, [editingPreset]);

    function resetForm() {
        setName("");
        setDescription("");
        setBadgeText("");
        setSelectedOptions({});
    }

    function handleOptionChange(groupId: string, optionId: string) {
        setSelectedOptions((prev) => ({
            ...prev,
            [groupId]: optionId,
        }));
    }

    function handleClearOption(groupId: string) {
        setSelectedOptions((prev) => {
            const next = { ...prev };
            delete next[groupId];
            return next;
        });
    }

    // Calculate estimated price from selected options
    function getEstimatedPrice(): number {
        let total = 0;
        for (const [groupId, optionId] of Object.entries(selectedOptions)) {
            const group = optionGroups.find((g) => g.id === groupId);
            const option = group?.options.find((o) => o.id === optionId);
            if (option) {
                if (option.priceModifierType === "add") {
                    total += option.priceModifierAmount;
                }
            }
        }
        return total;
    }

    const selectedCount = Object.keys(selectedOptions).length;
    const estimatedPrice = getEstimatedPrice();

    function handleSubmit() {
        if (!name.trim()) return;

        startTransition(async () => {
            const params = {
                name: name.trim(),
                description: description.trim() || undefined,
                badgeText: badgeText.trim() || undefined,
                selectedOptions,
            };

            let result;
            if (editingPreset) {
                result = await updatePreset(editingPreset.id, {
                    ...params,
                    cachedTotalPrice: estimatedPrice > 0 ? estimatedPrice : undefined,
                });
            } else {
                result = await createPreset(templateId, params);
            }

            if (result.success) {
                resetForm();
                onSuccess();
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingPreset ? "Edit Preset" : "Create Preset"}
                    </DialogTitle>
                    <DialogDescription>
                        Select options for each group to create a curated configuration preset.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="preset-name">Preset Name</Label>
                        <Input
                            id="preset-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='e.g., "Performance", "Budget", "Professional"'
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="preset-desc">Description</Label>
                        <Textarea
                            id="preset-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of who this preset is for"
                            rows={2}
                        />
                    </div>

                    {/* Badge Text */}
                    <div className="space-y-2">
                        <Label htmlFor="badge-text">Badge Text (optional)</Label>
                        <Input
                            id="badge-text"
                            value={badgeText}
                            onChange={(e) => setBadgeText(e.target.value)}
                            placeholder='e.g., "Best Value", "Most Popular", "Premium"'
                        />
                    </div>

                    {/* Option Selection per Group */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Select Options ({selectedCount}/{optionGroups.length} groups)
                        </Label>
                        <div className="space-y-3">
                            {optionGroups.map((group) => (
                                <div
                                    key={group.id}
                                    className="p-3 rounded-lg border bg-muted/30 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">{group.name}</Label>
                                        {selectedOptions[group.id] && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs"
                                                onClick={() => handleClearOption(group.id)}
                                            >
                                                Clear
                                            </Button>
                                        )}
                                    </div>
                                    <Select
                                        value={selectedOptions[group.id] || ""}
                                        onValueChange={(v) => handleOptionChange(group.id, v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={`Select ${group.name}…`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {group.options.map((opt) => (
                                                <SelectItem key={opt.id} value={opt.id}>
                                                    <span>{opt.name}</span>
                                                    {opt.priceModifierAmount > 0 && (
                                                        <span className="text-muted-foreground ml-2">
                                                            (+${opt.priceModifierAmount})
                                                        </span>
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Estimated Price */}
                    {estimatedPrice > 0 && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                            <span className="text-muted-foreground">Estimated addon price: </span>
                            <span className="font-semibold text-primary">
                                +${estimatedPrice.toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || !name.trim() || selectedCount === 0}
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving…
                            </>
                        ) : editingPreset ? (
                            "Save Changes"
                        ) : (
                            "Create Preset"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
