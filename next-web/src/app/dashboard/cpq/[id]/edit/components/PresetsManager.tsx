"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Plus,
    Trash2,
    Pencil,
    Package,
    GripVertical,
    Sparkles,
} from "lucide-react";
import type { TemplatePreset, OptionGroup } from "@/app/actions/cpq/template-actions";
import { deletePreset, togglePresetActive } from "@/app/actions/cpq/preset-actions";
import { AddPresetDialog } from "./AddPresetDialog";
import { useRouter } from "next/navigation";

interface PresetsManagerProps {
    templateId: string;
    presets: TemplatePreset[];
    optionGroups: OptionGroup[];
}

export function PresetsManager({ templateId, presets, optionGroups }: PresetsManagerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<TemplatePreset | null>(null);
    const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

    // Build option name lookup
    const optionNameMap = new Map<string, string>();
    const groupNameMap = new Map<string, string>();
    for (const group of optionGroups) {
        groupNameMap.set(group.id, group.name);
        for (const opt of group.options) {
            optionNameMap.set(opt.id, opt.name);
        }
    }

    function getPresetSummary(preset: TemplatePreset): string {
        const entries = Object.entries(preset.selectedOptions);
        if (entries.length === 0) return "No options selected";

        const parts = entries.slice(0, 3).map(([groupId, optionId]) => {
            const optName = optionNameMap.get(optionId) || optionId;
            return optName;
        });

        if (entries.length > 3) {
            parts.push(`+${entries.length - 3} more`);
        }
        return parts.join(" · ");
    }

    async function handleDelete(presetId: string) {
        startTransition(async () => {
            const result = await deletePreset(presetId);
            if (result.success) {
                router.refresh();
            }
            setDeletingPresetId(null);
        });
    }

    async function handleToggleActive(presetId: string) {
        startTransition(async () => {
            const result = await togglePresetActive(presetId);
            if (result.success) {
                router.refresh();
            }
        });
    }

    function handleAddSuccess() {
        setAddDialogOpen(false);
        setEditingPreset(null);
        router.refresh();
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Template Presets</CardTitle>
                            <CardDescription>
                                Create pre-configured bundles (e.g., &quot;Performance&quot;, &quot;Budget&quot;, &quot;Professional&quot;)
                            </CardDescription>
                        </div>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Preset
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {presets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Presets Yet</h3>
                            <p className="text-muted-foreground max-w-md mb-6">
                                Presets reduce choice paralysis by offering curated option combinations.
                                Think &quot;Budget&quot;, &quot;Mid-Range&quot;, &quot;High-End&quot; configurations.
                            </p>
                            <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Preset
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {presets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${preset.isActive
                                            ? "bg-card hover:bg-accent/50"
                                            : "bg-muted/30 opacity-60"
                                        }`}
                                >
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />

                                    <Package className="h-5 w-5 text-primary flex-shrink-0" />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{preset.name}</span>
                                            {preset.badgeText && (
                                                <Badge variant="secondary" className="flex-shrink-0">
                                                    {preset.badgeText}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                                            {getPresetSummary(preset)}
                                        </p>
                                        {preset.description && (
                                            <p className="text-xs text-muted-foreground mt-1 italic truncate">
                                                {preset.description}
                                            </p>
                                        )}
                                    </div>

                                    {preset.cachedTotalPrice !== null && (
                                        <span className="text-sm font-medium text-primary flex-shrink-0">
                                            ${preset.cachedTotalPrice.toLocaleString()}
                                        </span>
                                    )}

                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                        {Object.keys(preset.selectedOptions).length} options
                                    </span>

                                    <Switch
                                        checked={preset.isActive}
                                        onCheckedChange={() => handleToggleActive(preset.id)}
                                        disabled={isPending}
                                    />

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setEditingPreset(preset);
                                                setAddDialogOpen(true);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => setDeletingPresetId(preset.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddPresetDialog
                open={addDialogOpen}
                onOpenChange={(open: boolean) => {
                    setAddDialogOpen(open);
                    if (!open) setEditingPreset(null);
                }}
                templateId={templateId}
                optionGroups={optionGroups}
                editingPreset={editingPreset}
                onSuccess={handleAddSuccess}
            />

            <Dialog
                open={!!deletingPresetId}
                onOpenChange={(open: boolean) => {
                    if (!open) setDeletingPresetId(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Preset</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this preset? Users will no longer be able
                            to select it as a quick-start configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeletingPresetId(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingPresetId && handleDelete(deletingPresetId)}
                            disabled={isPending}
                        >
                            {isPending ? "Deleting..." : "Delete Preset"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
