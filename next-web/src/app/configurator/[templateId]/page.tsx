"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ConfiguratorLayout } from "@/components/configurator/ConfiguratorLayout";
import { useConfiguratorState } from "@/components/configurator/hooks/useConfiguratorState";
import { getTemplateById } from "@/app/actions/cpq/template-actions";
import { getConfiguration } from "@/app/actions/cpq/configuration-actions";
import { addConfiguredProductToQuote } from "@/app/actions/cpq/quote-integration-actions";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Inner component that uses hooks unconditionally
function ConfiguratorInner({ templateData, configId, templateId }: any) {
    const router = useRouter();
    const { toast } = useToast();

    // Always call hooks unconditionally
    const configuratorState = useConfiguratorState(
        templateData.template,
        templateData.optionGroups,
        templateData.rules,
        templateData.presets,
        configId || undefined
    );

    // Handlers
    const handleSave = async () => {
        const result = await configuratorState.save();
        if (result.success) {
            toast({
                title: "Configuration saved",
                description: "Your configuration has been saved successfully.",
            });

            // Update URL with config ID
            if (result.configId) {
                router.push(`/configurator/${templateId}?config=${result.configId}`);
            }
        } else {
            toast({
                title: "Save failed",
                description: "Failed to save configuration. Please try again.",
                variant: "destructive",
            });
        }
    };

    const handleShare = async () => {
        // Save first to get share token
        const result = await configuratorState.save();
        if (result.success && result.configId) {
            const shareUrl = `${window.location.origin}/configurator/shared/${result.configId}`;
            await navigator.clipboard.writeText(shareUrl);

            toast({
                title: "Share link copied",
                description: "Share link has been copied to clipboard.",
            });
        }
    };

    const handleAddToQuote = async () => {
        if (!configuratorState.configurationId) {
            // Must save first
            const saveResult = await configuratorState.save();
            if (!saveResult.success) {
                toast({
                    title: "Save required",
                    description: "Please save your configuration before adding to quote.",
                    variant: "destructive",
                });
                return;
            }
        }

        // TODO Phase 2: Implement quote selector dialog
        toast({
            title: "Quote Integration Needed",
            description: "Please implement quote selector or auto-create quote in Phase 2.",
            variant: "destructive",
        });
    };

    return (
        <ConfiguratorLayout
            state={configuratorState}
            onSave={handleSave}
            onShare={handleShare}
            onAddToQuote={handleAddToQuote}
        />
    );
}

// Outer component that handles loading
export default function ProductConfiguratorPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const templateId = params.templateId as string;
    const configId = searchParams.get("config");

    const [isLoading, setIsLoading] = useState(true);
    const [templateData, setTemplateData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Load template (and configuration if editing)
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);

            // 1. Load template
            const templateResult = await getTemplateById(templateId);
            if (!templateResult.success || !templateResult.data) {
                setError(templateResult.error || "Failed to load template");
                setIsLoading(false);
                return;
            }

            setTemplateData(templateResult.data);

            // 2. Load existing configuration if configId present
            if (configId) {
                const configResult = await getConfiguration(configId);
                if (configResult.success && configResult.data) {
                    // Pre-fill selections (handled by useConfiguratorState)
                }
            }

            setIsLoading(false);
        };

        load();
    }, [templateId, configId]);

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-muted-foreground">Loading configurator...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !templateData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-destructive">Error</h2>
                    <p className="text-muted-foreground">{error || "Failed to load configurator"}</p>
                </div>
            </div>
        );
    }

    // Main view - only render inner component when data is loaded
    return <ConfiguratorInner templateData={templateData} configId={configId} templateId={templateId} />;
}
