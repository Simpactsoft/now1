"use client";

import { Settings, Copy, Eye, DollarSign } from "lucide-react";
import { Configuration } from "@/app/actions/cpq/configuration-actions";

interface ConfigurationTemplatesTabProps {
    configurations: Configuration[];
    loading: boolean;
    onClone: (config: Configuration) => void;
    onEdit?: (config: Configuration) => void;
    onView?: (config: Configuration) => void;
}

export default function ConfigurationTemplatesTab({
    configurations,
    loading,
    onClone,
    onEdit,
    onView
}: ConfigurationTemplatesTabProps) {

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading configurations...</p>
                </div>
            </div>
        );
    }

    if (configurations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center max-w-md">
                    <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Saved Configurations</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Configuration templates appear here after you save them from the Quote Builder.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        To create a configuration template: Go to Quote Builder → Configure a product → Save as Template
                    </p>
                </div>
            </div>
        );
    }

    const getOptionsSummary = (selectedOptions: Record<string, string | string[]> | null): string => {
        if (!selectedOptions) return "No options";
        const options = Object.entries(selectedOptions);
        if (options.length === 0) return "No options";
        return options.map(([key, value]) => Array.isArray(value) ? value.join(", ") : `${value}`).join(" • ");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-24">
            {configurations.map(config => (
                <div
                    key={config.id}
                    className="group relative p-6 border border-border rounded-xl hover:border-primary hover:bg-accent/50 hover:shadow-lg transition-all"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                {config.templateName || "Unnamed Configuration"}
                            </h3>
                            <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                                <DollarSign className="w-5 h-5" />
                                {config.totalPrice.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Options Summary */}
                    <div className="mb-4 min-h-[60px]">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Selected Options:</p>
                        <p className="text-sm line-clamp-3">
                            {getOptionsSummary(config.selectedOptions)}
                        </p>
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-1 mb-4 pb-4 border-b border-border">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Base Price:</span>
                            <span>${config.basePrice.toFixed(2)}</span>
                        </div>
                        {config.optionsTotal > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Options Total:</span>
                                <span>+${config.optionsTotal.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        {onView && (
                            <button
                                onClick={() => onView(config)}
                                className="flex-1 px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors flex items-center justify-center gap-1"
                                title="View Details"
                            >
                                <Eye className="w-3 h-3" />
                                View
                            </button>
                        )}
                        <button
                            onClick={() => onClone(config)}
                            className="flex-1 px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors flex items-center justify-center gap-1"
                            title="Clone as New Template"
                        >
                            <Copy className="w-3 h-3" />
                            Clone
                        </button>
                        {onEdit && (
                            <button
                                onClick={() => onEdit(config)}
                                className="flex-1 px-3 py-2 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors flex items-center justify-center gap-1"
                                title="Edit Configuration"
                            >
                                <Settings className="w-3 h-3" />
                                Edit
                            </button>
                        )}
                    </div>

                    {/* Metadata */}
                    {config.notes && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground italic line-clamp-2">
                                {config.notes}
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
