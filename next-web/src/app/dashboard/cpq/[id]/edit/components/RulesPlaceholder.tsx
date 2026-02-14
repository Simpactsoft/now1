"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import type { ConfigurationRule } from "@/app/actions/cpq/template-actions";

interface RulesPlaceholderProps {
    templateId: string;
    rules: ConfigurationRule[];
}

export function RulesPlaceholder({ templateId, rules }: RulesPlaceholderProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Configuration Rules</CardTitle>
                        <CardDescription>
                            Define dependencies, conflicts, and business logic
                        </CardDescription>
                    </div>
                    <Button disabled>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rule
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Info className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Coming in Week 3</h3>
                    <p className="text-muted-foreground max-w-md">
                        The Rules Builder will enable you to create validation rules like "requires",
                        "conflicts", "hides", "auto_select", and volume-based pricing tiers.
                    </p>
                    <div className="mt-6 text-sm text-muted-foreground">
                        <p>Current rules: {rules.length}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
