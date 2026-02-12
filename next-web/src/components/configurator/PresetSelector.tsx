"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TemplatePreset } from "@/app/actions/cpq/template-actions";
import { Check } from "lucide-react";

interface PresetSelectorProps {
    presets: TemplatePreset[];
    selectedPresetId: string | null;
    onSelectPreset: (presetId: string) => void;
    onStartFromScratch: () => void;
}

/**
 * Preset Selector - BMW "Sport Line" pattern.
 * Displays curated preset configurations to reduce choice paralysis.
 */
export function PresetSelector({
    presets,
    selectedPresetId,
    onSelectPreset,
    onStartFromScratch,
}: PresetSelectorProps) {
    if (presets.length === 0) {
        // No presets - skip selector
        return null;
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold">Choose Your Starting Point</h2>
                <p className="text-muted-foreground">
                    Select a preset configuration or start from scratch
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Start from scratch option */}
                <Card
                    className={`cursor-pointer transition-all hover:shadow-lg ${selectedPresetId === null ? "ring-2 ring-primary" : ""
                        }`}
                    onClick={onStartFromScratch}
                >
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Custom Configuration</span>
                            {selectedPresetId === null && <Check className="h-5 w-5 text-primary" />}
                        </CardTitle>
                        <CardDescription>Build your own from scratch</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Choose every option individually to create your perfect configuration.
                        </p>
                    </CardContent>
                </Card>

                {/* Preset cards */}
                {presets.map((preset) => (
                    <Card
                        key={preset.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${selectedPresetId === preset.id ? "ring-2 ring-primary" : ""
                            }`}
                        onClick={() => onSelectPreset(preset.id)}
                    >
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>{preset.name}</span>
                                {selectedPresetId === preset.id && <Check className="h-5 w-5 text-primary" />}
                            </CardTitle>
                            {preset.badgeText && (
                                <Badge variant="secondary" className="w-fit">
                                    {preset.badgeText}
                                </Badge>
                            )}
                            <CardDescription>{preset.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {preset.imageUrl && (
                                <img
                                    src={preset.imageUrl}
                                    alt={preset.name}
                                    className="w-full h-32 object-cover rounded-md"
                                />
                            )}
                            {preset.cachedTotalPrice && (
                                <div className="text-lg font-semibold">
                                    ${preset.cachedTotalPrice.toFixed(2)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
