"use client";

import { useState, useEffect } from "react";
import { Package, Plus, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    getConfigurationTemplates,
    cloneConfiguration,
    type Configuration,
} from "@/app/actions/cpq/configuration-actions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConfigurationsListProps {
    onAddToQuote: (configuration: Configuration) => void;
    loading?: boolean;
}

export default function ConfigurationsList({
    onAddToQuote,
    loading: externalLoading,
}: ConfigurationsListProps) {
    const [configurations, setConfigurations] = useState<Configuration[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        loadConfigurations();
    }, []);

    async function loadConfigurations() {
        setLoading(true);
        const result = await getConfigurationTemplates();

        if (result.success && result.data) {
            setConfigurations(result.data);
        } else {
            toast({
                title: "Error",
                description: result.error || "Failed to load configurations",
                variant: "destructive",
            });
        }
        setLoading(false);
    }

    async function handleAddToQuote(config: Configuration) {
        setAddingId(config.id);

        // Clone the configuration (creates a new draft based on template)
        const result = await cloneConfiguration(config.id);

        if (result.success && result.data) {
            onAddToQuote(result.data);
            toast({
                title: "Added to quote",
                description: `${config.templateName} has been added to your quote.`,
            });
        } else {
            toast({
                title: "Error",
                description: result.error || "Failed to add configuration",
                variant: "destructive",
            });
        }

        setAddingId(null);
    }

    function getOptionsSummary(config: Configuration): string {
        const options = Object.values(config.selectedOptions);
        if (options.length === 0) return "No options selected";

        // Show first 3-4 option names
        const optionNames = options.slice(0, 4);
        const summary = optionNames.join(" • ");

        if (options.length > 4) {
            return `${summary} • +${options.length - 4} more`;
        }

        return summary;
    }

    const isLoading = loading || externalLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (configurations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground animate-in fade-in-50">
                <Settings className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">תבניות שמורות (Saved Templates)</h3>
                <p className="text-sm text-center max-w-md mb-4 leading-relaxed">
                    כאן יופיעו תבניות ששמרת מתוך הצעות מחיר (Saved configurations).
                    <br /><br />
                    הערה: כדי להוסיף מוצר שניתן להגדרה (Configurable Product) להצעת מחיר, חפש אותו בלשונית המוצרים הרגילה.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-20 overflow-y-auto h-[600px]">
            {configurations.map((config) => {
                const isAdding = addingId === config.id;
                const optionsSummary = getOptionsSummary(config);

                return (
                    <div
                        key={config.id}
                        className={cn(
                            "group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 bg-card hover:shadow-md",
                            isAdding && "opacity-50 pointer-events-none"
                        )}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Settings className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                Qty: {config.quantity}
                            </span>
                        </div>

                        {/* Content */}
                        <div className="space-y-2 mb-3 flex-1">
                            <h3 className="font-semibold text-base leading-tight">
                                {config.templateName}
                            </h3>

                            {config.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {config.notes}
                                </p>
                            )}

                            <div className="text-xs text-muted-foreground/80 line-clamp-2">
                                {optionsSummary}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                            <div className="font-bold text-lg text-primary">
                                ${config.totalPrice.toFixed(2)}
                            </div>
                            <Button
                                size="sm"
                                onClick={() => handleAddToQuote(config)}
                                disabled={isAdding}
                                className="gap-2"
                            >
                                {isAdding ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3 h-3" />
                                        Add
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
