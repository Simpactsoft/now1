"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { saveAsTemplate, type Configuration } from "@/app/actions/cpq/configuration-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface SaveTemplateDialogProps {
    configurationId: string;
    onSaved?: (configuration: Configuration) => void;
    trigger?: React.ReactNode;
}

export function SaveTemplateDialog({ configurationId, onSaved, trigger }: SaveTemplateDialogProps) {
    const [open, setOpen] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    async function handleSave() {
        if (!templateName.trim()) {
            setError("Please enter a template name");
            return;
        }

        setLoading(true);
        setError(null);

        const result = await saveAsTemplate({
            configurationId,
            templateName: templateName.trim(),
        });

        setLoading(false);

        if (result.success && result.data) {
            toast({
                title: "Template saved",
                description: `"${result.data.templateName}" is now available as a reusable template.`,
            });
            onSaved?.(result.data);
            setOpen(false);
            setTemplateName("");
        } else {
            setError(result.error || "Failed to save template");
        }
    }

    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
        if (!newOpen) {
            setTemplateName("");
            setError(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Save className="mr-2 h-4 w-4" />
                        Save as Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Save as Template</DialogTitle>
                    <DialogDescription>
                        Save this configuration as a reusable template that you can load later.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                            id="template-name"
                            placeholder="e.g., Standard Gaming PC"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !loading) {
                                    handleSave();
                                }
                            }}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Choose a descriptive name to help identify this template later.
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || !templateName.trim()}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Template
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
