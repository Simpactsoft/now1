"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Info } from "lucide-react";
import type { ProductTemplate } from "@/app/actions/cpq/template-actions";

interface PreviewPlaceholderProps {
    template: ProductTemplate;
}

export function PreviewPlaceholder({ template }: PreviewPlaceholderProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>
                            Test your configurator as an end-user would see it
                        </CardDescription>
                    </div>
                    <Button disabled>
                        <Eye className="h-4 w-4 mr-2" />
                        Open in New Tab
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Info className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Coming in Week 5</h3>
                    <p className="text-muted-foreground max-w-md">
                        The Preview tab will embed a live, functional version of the end-user configurator,
                        allowing you to test option selection, rules validation, and price calculations before
                        publishing.
                    </p>
                    {template.isActive && (
                        <div className="mt-6">
                            <Button variant="link" asChild>
                                <a href={`/configurator/${template.id}`} target="_blank" rel="noopener noreferrer">
                                    View published configurator →
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
