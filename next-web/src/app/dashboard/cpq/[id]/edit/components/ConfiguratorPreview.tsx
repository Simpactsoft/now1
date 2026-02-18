"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Eye,
    ExternalLink,
    Monitor,
    Smartphone,
    Tablet,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";
import type { ProductTemplate, OptionGroup, ConfigurationRule, TemplatePreset } from "@/app/actions/cpq/template-actions";

interface ConfiguratorPreviewProps {
    template: ProductTemplate;
    optionGroups: OptionGroup[];
    rules: ConfigurationRule[];
    presets: TemplatePreset[];
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<ViewportSize, { width: string; icon: React.ReactNode; label: string }> = {
    desktop: { width: "100%", icon: <Monitor className="h-4 w-4" />, label: "Desktop" },
    tablet: { width: "768px", icon: <Tablet className="h-4 w-4" />, label: "Tablet" },
    mobile: { width: "375px", icon: <Smartphone className="h-4 w-4" />, label: "Mobile" },
};

export function ConfiguratorPreview({
    template,
    optionGroups,
    rules,
    presets,
}: ConfiguratorPreviewProps) {
    const [viewport, setViewport] = useState<ViewportSize>("desktop");
    const [iframeKey, setIframeKey] = useState(0);
    const [showPreview, setShowPreview] = useState(false);

    const configuratorUrl = `/configurator/${template.id}`;
    const vpConfig = VIEWPORT_CONFIG[viewport];

    const hasOptionGroups = optionGroups.length > 0;
    const hasOptions = optionGroups.some((g) => g.options.length > 0);

    // Readiness checklist
    const checks = [
        {
            label: "Template settings configured",
            ok: !!template.name && template.basePrice >= 0,
        },
        {
            label: `Option groups defined (${optionGroups.length})`,
            ok: hasOptionGroups,
        },
        {
            label: `Options available (${optionGroups.reduce((s, g) => s + g.options.length, 0)})`,
            ok: hasOptions,
        },
        {
            label: `Rules configured (${rules.length})`,
            ok: true, // Rules are optional
        },
        {
            label: `Presets created (${presets.length})`,
            ok: true, // Presets are optional
        },
        {
            label: "Template published",
            ok: template.isActive,
        },
    ];

    const isReady = hasOptionGroups && hasOptions;

    return (
        <div className="space-y-6">
            {/* Readiness Checklist */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Preview Readiness</CardTitle>
                            <CardDescription>
                                Check that your template is ready for end-users
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {template.isActive && (
                                <Button variant="outline" asChild>
                                    <a
                                        href={configuratorUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Open in New Tab
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {checks.map((check, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 text-sm"
                            >
                                {check.ok ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                )}
                                <span className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                                    {check.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Live Preview */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Live Preview
                            </CardTitle>
                            <CardDescription>
                                Test your configurator as an end-user would see it
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Viewport switcher */}
                            {showPreview && (
                                <>
                                    {(Object.entries(VIEWPORT_CONFIG) as [ViewportSize, typeof vpConfig][]).map(
                                        ([key, cfg]) => (
                                            <Button
                                                key={key}
                                                variant={viewport === key ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setViewport(key)}
                                            >
                                                {cfg.icon}
                                            </Button>
                                        )
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIframeKey((k) => k + 1)}
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!isReady ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Not Ready for Preview</h3>
                            <p className="text-muted-foreground max-w-md">
                                Add at least one option group with options before previewing.
                                Go to the <strong>Option Groups</strong> tab to get started.
                            </p>
                        </div>
                    ) : !showPreview ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Ready to Preview</h3>
                            <p className="text-muted-foreground max-w-md mb-6">
                                Launch an embedded preview to test the configurator experience.
                                {!template.isActive && (
                                    <span className="block mt-2 text-amber-600">
                                        Note: Template is in draft mode. Preview works, but users won&apos;t see it yet.
                                    </span>
                                )}
                            </p>
                            <Button onClick={() => setShowPreview(true)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Launch Preview
                            </Button>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div
                                className="border rounded-lg overflow-hidden bg-background transition-all duration-300"
                                style={{
                                    width: vpConfig.width,
                                    maxWidth: "100%",
                                }}
                            >
                                {/* Browser chrome bar */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b text-xs text-muted-foreground">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                    </div>
                                    <div className="flex-1 text-center font-mono truncate">
                                        {configuratorUrl}
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">
                                        {vpConfig.label}
                                    </Badge>
                                </div>

                                {/* Iframe */}
                                <iframe
                                    key={iframeKey}
                                    src={configuratorUrl}
                                    className="w-full border-0"
                                    style={{ height: "600px" }}
                                    title="Configurator Preview"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
