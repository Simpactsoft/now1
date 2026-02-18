"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Plus,
    Trash2,
    Pencil,
    ArrowRight,
    AlertTriangle,
    Ban,
    EyeOff,
    Zap,
    DollarSign,
    GripVertical,
} from "lucide-react";
import type { ConfigurationRule, OptionGroup } from "@/app/actions/cpq/template-actions";
import { deleteRule, toggleRuleActive } from "@/app/actions/cpq/rule-actions";
import { AddRuleDialog } from "./AddRuleDialog";
import { useRouter } from "next/navigation";

interface RulesManagerProps {
    templateId: string;
    rules: ConfigurationRule[];
    optionGroups: OptionGroup[];
}

const RULE_TYPE_CONFIG: Record<
    string,
    { label: string; color: string; icon: React.ReactNode; description: string }
> = {
    requires: {
        label: "Requires",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        icon: <ArrowRight className="h-3 w-3" />,
        description: "IF selected THEN must also select",
    },
    conflicts: {
        label: "Conflicts",
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        icon: <Ban className="h-3 w-3" />,
        description: "IF selected THEN cannot select",
    },
    hides: {
        label: "Hides",
        color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        icon: <EyeOff className="h-3 w-3" />,
        description: "IF selected THEN hide from view",
    },
    auto_select: {
        label: "Auto Select",
        color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        icon: <Zap className="h-3 w-3" />,
        description: "IF selected THEN auto-select",
    },
    price_tier: {
        label: "Price Tier",
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        icon: <DollarSign className="h-3 w-3" />,
        description: "Volume discount rule",
    },
};

export function RulesManager({ templateId, rules, optionGroups }: RulesManagerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<ConfigurationRule | null>(null);
    const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

    // Build lookup maps for option/group names
    const groupNameMap = new Map<string, string>();
    const optionNameMap = new Map<string, string>();
    const optionGroupMap = new Map<string, string>(); // optionId → groupName

    for (const group of optionGroups) {
        groupNameMap.set(group.id, group.name);
        for (const opt of group.options) {
            optionNameMap.set(opt.id, opt.name);
            optionGroupMap.set(opt.id, group.name);
        }
    }

    function getConditionLabel(rule: ConfigurationRule): string {
        if (rule.ifOptionId) {
            const optName = optionNameMap.get(rule.ifOptionId) || "Unknown option";
            const grpName = optionGroupMap.get(rule.ifOptionId) || "";
            return grpName ? `${grpName} → ${optName}` : optName;
        }
        if (rule.ifGroupId) {
            return groupNameMap.get(rule.ifGroupId) || "Unknown group";
        }
        return "Any selection";
    }

    function getActionLabel(rule: ConfigurationRule): string {
        if (rule.thenOptionId) {
            const optName = optionNameMap.get(rule.thenOptionId) || "Unknown option";
            const grpName = optionGroupMap.get(rule.thenOptionId) || "";
            return grpName ? `${grpName} → ${optName}` : optName;
        }
        if (rule.thenGroupId) {
            return groupNameMap.get(rule.thenGroupId) || "Unknown group";
        }
        if (rule.ruleType === "price_tier") {
            const parts: string[] = [];
            if (rule.quantityMin) parts.push(`qty ≥ ${rule.quantityMin}`);
            if (rule.quantityMax) parts.push(`qty ≤ ${rule.quantityMax}`);
            if (rule.discountValue) {
                parts.push(
                    rule.discountType === "percentage"
                        ? `${rule.discountValue}% off`
                        : `$${rule.discountValue} off`
                );
            }
            return parts.join(", ") || "Volume discount";
        }
        return "—";
    }

    async function handleDelete(ruleId: string) {
        startTransition(async () => {
            const result = await deleteRule(ruleId);
            if (result.success) {
                router.refresh();
            }
            setDeletingRuleId(null);
        });
    }

    async function handleToggleActive(ruleId: string) {
        startTransition(async () => {
            const result = await toggleRuleActive(ruleId);
            if (result.success) {
                router.refresh();
            }
        });
    }

    function handleAddSuccess() {
        setAddDialogOpen(false);
        setEditingRule(null);
        router.refresh();
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Configuration Rules</CardTitle>
                            <CardDescription>
                                Define dependencies, conflicts, and business logic between options
                            </CardDescription>
                        </div>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Rule
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Rules Defined</h3>
                            <p className="text-muted-foreground max-w-md mb-6">
                                Add rules to validate configurations, define dependencies between
                                options, and create smart business logic.
                            </p>
                            <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Rule
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rules.map((rule) => {
                                const config = RULE_TYPE_CONFIG[rule.ruleType] || RULE_TYPE_CONFIG.requires;
                                return (
                                    <div
                                        key={rule.id}
                                        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${rule.isActive
                                                ? "bg-card hover:bg-accent/50"
                                                : "bg-muted/30 opacity-60"
                                            }`}
                                    >
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />

                                        <Badge
                                            variant="secondary"
                                            className={`${config.color} flex items-center gap-1 flex-shrink-0`}
                                        >
                                            {config.icon}
                                            {config.label}
                                        </Badge>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{rule.name}</div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    IF
                                                </span>
                                                <span className="truncate">
                                                    {getConditionLabel(rule)}
                                                </span>
                                                <ArrowRight className="h-3 w-3 flex-shrink-0 mx-1" />
                                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    THEN
                                                </span>
                                                <span className="truncate">
                                                    {getActionLabel(rule)}
                                                </span>
                                            </div>
                                            {rule.errorMessage && (
                                                <p className="text-xs text-muted-foreground mt-1 italic truncate">
                                                    Error: &quot;{rule.errorMessage}&quot;
                                                </p>
                                            )}
                                        </div>

                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                            #{rule.priority}
                                        </span>

                                        <Switch
                                            checked={rule.isActive}
                                            onCheckedChange={() => handleToggleActive(rule.id)}
                                            disabled={isPending}
                                        />

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditingRule(rule);
                                                    setAddDialogOpen(true);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeletingRuleId(rule.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddRuleDialog
                open={addDialogOpen}
                onOpenChange={(open: boolean) => {
                    setAddDialogOpen(open);
                    if (!open) setEditingRule(null);
                }}
                templateId={templateId}
                optionGroups={optionGroups}
                editingRule={editingRule}
                onSuccess={handleAddSuccess}
            />

            <Dialog
                open={!!deletingRuleId}
                onOpenChange={(open: boolean) => {
                    if (!open) setDeletingRuleId(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Rule</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this rule? This action cannot be undone.
                            The rule will no longer be applied to configurations.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeletingRuleId(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingRuleId && handleDelete(deletingRuleId)}
                            disabled={isPending}
                        >
                            {isPending ? "Deleting..." : "Delete Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
