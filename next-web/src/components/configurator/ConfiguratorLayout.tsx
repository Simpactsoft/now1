"use client";

import { ReactNode } from "react";
import { PresetSelector } from "./PresetSelector";
import { OptionGroupComponent } from "./OptionGroup";
import { PriceSummary } from "./PriceSummary";
import type { ConfiguratorState } from "./hooks/useConfiguratorState";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface ConfiguratorLayoutProps {
    state: ConfiguratorState;
    onSave: () => void;
    onShare: () => void;
    onAddToQuote: () => void;
}

/**
 * ConfiguratorLayout - Main configurator UI.
 * Layout: Single-page (default) with sticky price summary.
 */
export function ConfiguratorLayout({
    state,
    onSave,
    onShare,
    onAddToQuote,
}: ConfiguratorLayoutProps) {
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [showPresets, setShowPresets] = useState(state.presets.length > 0);

    const handlePresetSelect = (presetId: string) => {
        setSelectedPresetId(presetId);
        state.applyPreset(presetId);
        setShowPresets(false);
    };

    const handleStartFromScratch = () => {
        setSelectedPresetId(null);
        state.reset();
        setShowPresets(false);
    };

    const canAddToQuote = state.validation?.isValid || false;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div>
                <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
                    <div className="py-6 border-b">
                        <h1 className="text-3xl font-bold">{state.template.name}</h1>
                        {state.template.description && (
                            <p className="text-muted-foreground mt-2">{state.template.description}</p>
                        )}
                        {state.template.imageUrl && (
                            <img
                                src={state.template.imageUrl}
                                alt={state.template.name}
                                className="mt-4 rounded-lg w-full max-w-2xl h-64 object-cover"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
                {/* Preset selector (if not dismissed) */}
                {showPresets && (
                    <div className="mb-8">
                        <PresetSelector
                            presets={state.presets}
                            selectedPresetId={selectedPresetId}
                            onSelectPreset={handlePresetSelect}
                            onStartFromScratch={handleStartFromScratch}
                        />
                        <Separator className="mt-8" />
                    </div>
                )}

                {/* Two-column layout: Option groups + Price summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Option groups (scrollable) */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold">Configure Your Product</h2>
                            {state.presets.length > 0 && !showPresets && (
                                <button
                                    onClick={() => setShowPresets(true)}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Back to presets
                                </button>
                            )}
                        </div>

                        {state.optionGroups
                            .filter((group) => !state.validation?.hiddenGroups.includes(group.id))
                            .map((group) => (
                                <OptionGroupComponent
                                    key={group.id}
                                    group={group}
                                    selectedValue={state.selections[group.id]}
                                    onChange={(value) => state.selectOption(group.id, value)}
                                    errors={state.validation?.errors || []}
                                    disabledOptions={state.validation?.disabledOptions || []}
                                    hiddenOptions={state.validation?.hiddenOptions || []}
                                />
                            ))}

                        {state.optionGroups.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                No configuration options available
                            </div>
                        )}
                    </div>

                    {/* Right: Price summary (sticky) */}
                    <div className="lg:col-span-1">
                        <PriceSummary
                            pricing={state.pricing}
                            quantity={state.quantity}
                            onQuantityChange={state.setQuantity}
                            onSave={onSave}
                            onShare={onShare}
                            onAddToQuote={onAddToQuote}
                            isSaving={state.isSaving}
                            isCalculating={state.isCalculating}
                            canAddToQuote={canAddToQuote}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
