"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Tag } from "lucide-react";
import { getConfigurationTemplates, type Configuration } from "@/app/actions/cpq/configuration-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TemplateSelectorProps {
    templateId: string; // Product template ID to filter by
    onSelectTemplate: (configuration: Configuration) => void;
    trigger?: React.ReactNode;
}

export function TemplateSelector({ templateId, onSelectTemplate, trigger }: TemplateSelectorProps) {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<Configuration[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open, templateId]);

    async function loadTemplates() {
        setLoading(true);
        setError(null);

        const result = await getConfigurationTemplates({ templateId });

        if (result.success && result.data) {
            setTemplates(result.data);
        } else {
            setError(result.error || "Failed to load templates");
        }

        setLoading(false);
    }

    function handleSelectTemplate(template: Configuration) {
        onSelectTemplate(template);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Package className="mr-2 h-4 w-4" />
                        Load from Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Load Configuration Template</DialogTitle>
                    <DialogDescription>
                        Select a saved template to start your configuration
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {!loading && !error && templates.length === 0 && (
                    <div className="text-center py-12">
                        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-sm text-muted-foreground">
                            No templates available yet.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Create a configuration and save it as a template to reuse it later.
                        </p>
                    </div>
                )}

                {!loading && !error && templates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template) => (
                            <Card
                                key={template.id}
                                className="cursor-pointer hover:border-primary transition-colors"
                                onClick={() => handleSelectTemplate(template)}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Tag className="h-4 w-4" />
                                                {template.templateName}
                                            </CardTitle>
                                            {template.notes && (
                                                <CardDescription className="mt-1 line-clamp-2">
                                                    {template.notes}
                                                </CardDescription>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Price:</span>
                                        <span className="font-semibold">
                                            ${template.totalPrice.toFixed(2)}
                                        </span>
                                    </div>
                                    {template.quantity > 1 && (
                                        <div className="flex items-center justify-between text-sm mt-1">
                                            <span className="text-muted-foreground">Quantity:</span>
                                            <span>{template.quantity}</span>
                                        </div>
                                    )}
                                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                                        {Object.keys(template.selectedOptions).length} options configured
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
