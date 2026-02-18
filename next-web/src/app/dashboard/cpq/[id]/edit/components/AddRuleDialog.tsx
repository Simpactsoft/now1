"use client";

import { useState, useTransition, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Ban, EyeOff, Zap, DollarSign, Loader2 } from "lucide-react";
import type { ConfigurationRule, OptionGroup } from "@/app/actions/cpq/template-actions";
import { createRule, updateRule } from "@/app/actions/cpq/rule-actions";

interface AddRuleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templateId: string;
    optionGroups: OptionGroup[];
    editingRule: ConfigurationRule | null;
    onSuccess: () => void;
}

type RuleType = "requires" | "conflicts" | "hides" | "auto_select" | "price_tier";

const RULE_TYPE_OPTIONS: { value: RuleType; label: string; icon: React.ReactNode; hint: string }[] = [
    {
        value: "requires",
        label: "Requires",
        icon: <ArrowRight className="h-4 w-4" />,
        hint: "IF option A is selected, THEN option B must also be selected",
    },
    {
        value: "conflicts",
        label: "Conflicts",
        icon: <Ban className="h-4 w-4" />,
        hint: "IF option A is selected, THEN option B cannot be selected",
    },
    {
        value: "hides",
        label: "Hides",
        icon: <EyeOff className="h-4 w-4" />,
        hint: "IF option A is selected, THEN hide option/group B from view",
    },
    {
        value: "auto_select",
        label: "Auto Select",
        icon: <Zap className="h-4 w-4" />,
        hint: "IF option A is selected, THEN automatically select option B",
    },
    {
        value: "price_tier",
        label: "Price Tier",
        icon: <DollarSign className="h-4 w-4" />,
        hint: "Volume-based discount: quantity thresholds with discount amounts",
    },
];

export function AddRuleDialog({
    open,
    onOpenChange,
    templateId,
    optionGroups,
    editingRule,
    onSuccess,
}: AddRuleDialogProps) {
    const [isPending, startTransition] = useTransition();

    // Form state
    const [ruleType, setRuleType] = useState<RuleType>("requires");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Condition (IF)
    const [ifType, setIfType] = useState<"option" | "group">("option");
    const [ifGroupId, setIfGroupId] = useState<string>("");
    const [ifOptionId, setIfOptionId] = useState<string>("");

    // Action (THEN)
    const [thenType, setThenType] = useState<"option" | "group">("option");
    const [thenGroupId, setThenGroupId] = useState<string>("");
    const [thenOptionId, setThenOptionId] = useState<string>("");

    // Price tier fields
    const [quantityMin, setQuantityMin] = useState<string>("");
    const [quantityMax, setQuantityMax] = useState<string>("");
    const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
    const [discountValue, setDiscountValue] = useState<string>("");

    const [priority, setPriority] = useState<string>("10");

    // Populate form when editing
    useEffect(() => {
        if (editingRule) {
            setRuleType(editingRule.ruleType);
            setName(editingRule.name);
            setDescription(editingRule.description || "");
            setErrorMessage(editingRule.errorMessage || "");
            setPriority(String(editingRule.priority));

            // IF condition
            if (editingRule.ifOptionId) {
                setIfType("option");
                setIfOptionId(editingRule.ifOptionId);
                // Find which group this option belongs to
                const group = optionGroups.find((g) =>
                    g.options.some((o) => o.id === editingRule.ifOptionId)
                );
                setIfGroupId(group?.id || "");
            } else if (editingRule.ifGroupId) {
                setIfType("group");
                setIfGroupId(editingRule.ifGroupId);
            }

            // THEN action
            if (editingRule.thenOptionId) {
                setThenType("option");
                setThenOptionId(editingRule.thenOptionId);
                const group = optionGroups.find((g) =>
                    g.options.some((o) => o.id === editingRule.thenOptionId)
                );
                setThenGroupId(group?.id || "");
            } else if (editingRule.thenGroupId) {
                setThenType("group");
                setThenGroupId(editingRule.thenGroupId);
            }

            // Price tier
            if (editingRule.quantityMin) setQuantityMin(String(editingRule.quantityMin));
            if (editingRule.quantityMax) setQuantityMax(String(editingRule.quantityMax));
            if (editingRule.discountType) setDiscountType(editingRule.discountType);
            if (editingRule.discountValue) setDiscountValue(String(editingRule.discountValue));
        } else {
            resetForm();
        }
    }, [editingRule, optionGroups]);

    function resetForm() {
        setRuleType("requires");
        setName("");
        setDescription("");
        setErrorMessage("");
        setIfType("option");
        setIfGroupId("");
        setIfOptionId("");
        setThenType("option");
        setThenGroupId("");
        setThenOptionId("");
        setQuantityMin("");
        setQuantityMax("");
        setDiscountType("percentage");
        setDiscountValue("");
        setPriority("10");
    }

    // Get options for the selected IF group
    const ifGroupOptions = ifGroupId
        ? optionGroups.find((g) => g.id === ifGroupId)?.options || []
        : [];

    // Get options for the selected THEN group
    const thenGroupOptions = thenGroupId
        ? optionGroups.find((g) => g.id === thenGroupId)?.options || []
        : [];

    const isPriceTier = ruleType === "price_tier";

    function handleSubmit() {
        if (!name.trim()) return;

        startTransition(async () => {
            const params = {
                ruleType,
                name: name.trim(),
                description: description.trim() || undefined,
                errorMessage: errorMessage.trim() || undefined,
                ifOptionId: ifType === "option" && ifOptionId ? ifOptionId : null,
                ifGroupId: ifType === "group" && ifGroupId ? ifGroupId : (ifType === "option" && ifGroupId ? null : null),
                thenOptionId: !isPriceTier && thenType === "option" && thenOptionId ? thenOptionId : null,
                thenGroupId: !isPriceTier && thenType === "group" && thenGroupId ? thenGroupId : (!isPriceTier && thenType === "option" && thenGroupId ? null : null),
                quantityMin: isPriceTier && quantityMin ? parseInt(quantityMin) : null,
                quantityMax: isPriceTier && quantityMax ? parseInt(quantityMax) : null,
                discountType: isPriceTier ? discountType : null,
                discountValue: isPriceTier && discountValue ? parseFloat(discountValue) : null,
                priority: parseInt(priority) || 10,
            };

            let result;
            if (editingRule) {
                result = await updateRule(editingRule.id, params);
            } else {
                result = await createRule(templateId, params);
            }

            if (result.success) {
                resetForm();
                onSuccess();
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingRule ? "Edit Rule" : "Add Configuration Rule"}
                    </DialogTitle>
                    <DialogDescription>
                        Define business logic that validates and guides user choices.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Rule Type */}
                    <div className="space-y-2">
                        <Label>Rule Type</Label>
                        <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RULE_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        <div className="flex items-center gap-2">
                                            {opt.icon}
                                            <span>{opt.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.hint}
                        </p>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="rule-name">Rule Name</Label>
                        <Input
                            id="rule-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., High-end GPU requires 750W PSU"
                        />
                    </div>

                    {/* IF Condition */}
                    {!isPriceTier && (
                        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded font-semibold">
                                    IF
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    When this is selected…
                                </span>
                            </div>

                            {/* IF type selector */}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={ifType === "option" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIfType("option")}
                                >
                                    Specific Option
                                </Button>
                                <Button
                                    type="button"
                                    variant={ifType === "group" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIfType("group")}
                                >
                                    Any in Group
                                </Button>
                            </div>

                            {/* IF Group */}
                            <div className="space-y-2">
                                <Label>Option Group</Label>
                                <Select value={ifGroupId} onValueChange={(v) => {
                                    setIfGroupId(v);
                                    setIfOptionId("");
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a group…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {optionGroups.map((g) => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.name} ({g.options.length} options)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* IF Option (when type=option) */}
                            {ifType === "option" && ifGroupId && (
                                <div className="space-y-2">
                                    <Label>Option</Label>
                                    <Select value={ifOptionId} onValueChange={setIfOptionId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an option…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ifGroupOptions.map((o) => (
                                                <SelectItem key={o.id} value={o.id}>
                                                    {o.name}
                                                    {o.priceModifierAmount > 0
                                                        ? ` (+$${o.priceModifierAmount})`
                                                        : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* THEN Action */}
                    {!isPriceTier && (
                        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded font-semibold">
                                    THEN
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {ruleType === "requires"
                                        ? "Must also select…"
                                        : ruleType === "conflicts"
                                            ? "Cannot select…"
                                            : ruleType === "hides"
                                                ? "Hide from view…"
                                                : "Auto-select…"}
                                </span>
                            </div>

                            {/* THEN type selector */}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={thenType === "option" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setThenType("option")}
                                >
                                    Specific Option
                                </Button>
                                <Button
                                    type="button"
                                    variant={thenType === "group" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setThenType("group")}
                                >
                                    Entire Group
                                </Button>
                            </div>

                            {/* THEN Group */}
                            <div className="space-y-2">
                                <Label>Target Group</Label>
                                <Select value={thenGroupId} onValueChange={(v) => {
                                    setThenGroupId(v);
                                    setThenOptionId("");
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select target group…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {optionGroups.map((g) => (
                                            <SelectItem key={g.id} value={g.id}>
                                                {g.name} ({g.options.length} options)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* THEN Option (when type=option) */}
                            {thenType === "option" && thenGroupId && (
                                <div className="space-y-2">
                                    <Label>Target Option</Label>
                                    <Select value={thenOptionId} onValueChange={setThenOptionId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select target option…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {thenGroupOptions.map((o) => (
                                                <SelectItem key={o.id} value={o.id}>
                                                    {o.name}
                                                    {o.priceModifierAmount > 0
                                                        ? ` (+$${o.priceModifierAmount})`
                                                        : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price Tier Fields */}
                    {isPriceTier && (
                        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Volume Discount</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="qty-min">Min Quantity</Label>
                                    <Input
                                        id="qty-min"
                                        type="number"
                                        min="1"
                                        value={quantityMin}
                                        onChange={(e) => setQuantityMin(e.target.value)}
                                        placeholder="e.g., 10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="qty-max">Max Quantity</Label>
                                    <Input
                                        id="qty-max"
                                        type="number"
                                        min="1"
                                        value={quantityMax}
                                        onChange={(e) => setQuantityMax(e.target.value)}
                                        placeholder="e.g., 50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Discount Type</Label>
                                    <Select
                                        value={discountType}
                                        onValueChange={(v) =>
                                            setDiscountType(v as "percentage" | "fixed_amount")
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                                            <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="discount-val">Discount Value</Label>
                                    <Input
                                        id="discount-val"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        placeholder={
                                            discountType === "percentage" ? "e.g., 10" : "e.g., 50"
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {(ruleType === "requires" || ruleType === "conflicts") && (
                        <div className="space-y-2">
                            <Label htmlFor="error-msg">Error Message (shown to user)</Label>
                            <Input
                                id="error-msg"
                                value={errorMessage}
                                onChange={(e) => setErrorMessage(e.target.value)}
                                placeholder="e.g., This GPU requires a 750W power supply"
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="rule-desc">Description (internal note)</Label>
                        <Textarea
                            id="rule-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional internal note about this rule"
                            rows={2}
                        />
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                        <Label htmlFor="priority">Priority (lower = evaluated first)</Label>
                        <Input
                            id="priority"
                            type="number"
                            min="1"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving…
                            </>
                        ) : editingRule ? (
                            "Save Changes"
                        ) : (
                            "Create Rule"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
