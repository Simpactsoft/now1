"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import type { TemplatePreset } from "@/app/actions/cpq/template-actions";

interface PresetsPlaceholderProps {
    templateId: string;
    presets: TemplatePreset[];
}

export function PresetsPlaceholder({ templateId, presets }: PresetsPlaceholderProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Template Presets</CardTitle>
                        <CardDescription>
                            Create pre-configured bundles (e.g., "Performance", "Budget", "Professional")
                        </CardDescription>
                    </div>
                    <Button disabled>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Preset
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Info className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Coming in Week 4</h3>
                    <p className="text-muted-foreground max-w-md">
                        The Presets Editor will allow you to create smart defaults that reduce choice
                        paralysis by offering curated option combinations (BMW "Sport Line" pattern).
                    </p>
                    <div className="mt-6 text-sm text-muted-foreground">
                        <p>Current presets: {presets.length}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
