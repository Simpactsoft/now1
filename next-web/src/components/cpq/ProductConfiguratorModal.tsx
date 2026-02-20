"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Plus, Minus } from "lucide-react";
import {
    getTemplateById,
    type ProductTemplate,
    type OptionGroup,
    type Option,
    type ConfigurationRule
} from "@/app/actions/cpq/template-actions";
import { validateConfigurationClientSide, type ValidationResult, type ValidationMessage } from "../configurator/hooks/client-validation";
import {
    saveConfiguration,
    getConfigurationTemplates,
    type Configuration,
} from "@/app/actions/cpq/configuration-actions";
import { TemplateSelector } from "./TemplateSelector";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ProductConfiguratorModalProps {
    isOpen: boolean;
    templateId: string;
    onClose: () => void;
    onAddToQuote: (configuration: Configuration) => void;
}

export function ProductConfiguratorModal({
    isOpen,
    templateId,
    onClose,
    onAddToQuote,
}: ProductConfiguratorModalProps) {
    const [template, setTemplate] = useState<ProductTemplate | null>(null);
    const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentConfigurationId, setCurrentConfigurationId] = useState<string | null>(null);
    const [rules, setRules] = useState<ConfigurationRule[]>([]);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && templateId) {
            loadTemplate();
        }
    }, [isOpen, templateId]);

    async function loadTemplate() {
        setLoading(true);
        setError(null);

        const result = await getTemplateById(templateId);

        if (result.success && result.data) {
            setTemplate(result.data.template);
            setOptionGroups(result.data.optionGroups);
            setRules(result.data.rules || []);

            // Set default selections
            const defaults: Record<string, string> = {};
            result.data.optionGroups.forEach((group) => {
                const defaultOption = group.options.find((opt) => opt.isDefault);
                if (defaultOption) {
                    defaults[group.id] = defaultOption.id;
                }
            });
            setSelectedOptions(defaults);
        } else {
            setError(result.error || "Failed to load template");
        }

        setLoading(false);
    }

    useEffect(() => {
        if (!template || optionGroups.length === 0) return;
        const res = validateConfigurationClientSide(optionGroups, selectedOptions, rules);
        setValidation(res);

        if (Object.keys(res.autoSelections).length > 0) {
            let changes = false;
            const newSelections = { ...selectedOptions };
            for (const [groupId, optionId] of Object.entries(res.autoSelections) as [string, string][]) {
                if (newSelections[groupId] !== optionId) {
                    newSelections[groupId] = optionId;
                    changes = true;
                }
            }
            if (changes) {
                // To avoid loops with useEffect, delay state update slightly
                setTimeout(() => setSelectedOptions(newSelections), 0);
            }
        }
    }, [selectedOptions, optionGroups, rules, template]);

    function handleOptionSelect(groupId: string, optionId: string) {
        setSelectedOptions((prev) => {
            const next = { ...prev };
            // Optional: toggle off if multi-select was supported, but currently it's radio-like
            next[groupId] = optionId;
            return next;
        });
    }
    function calculateTotalPrice(): number {
        if (!template) return 0;

        let basePrice = template.basePrice;
        let additiveTotal = 0;
        let multiplicativeFactor = 1;

        optionGroups.forEach((group) => {
            const selectedOptionId = selectedOptions[group.id];
            if (!selectedOptionId) return;

            const selectedOption = group.options.find((opt) => opt.id === selectedOptionId);
            if (!selectedOption) return;

            switch (selectedOption.priceModifierType) {
                case "add":
                    additiveTotal += selectedOption.priceModifierAmount;
                    break;
                case "multiply":
                    multiplicativeFactor *= selectedOption.priceModifierAmount;
                    break;
                case "replace":
                    basePrice = selectedOption.priceModifierAmount;
                    break;
            }
        });

        // Base + additives
        let subtotal = basePrice + additiveTotal;
        // Multiplicative
        subtotal = subtotal * multiplicativeFactor;

        // Apply price_tier rules (discounts based on quantity)
        if (rules && rules.length > 0) {
            const applicableTiers = rules
                .filter(r => r.ruleType === "price_tier" && r.isActive && r.quantityMin !== null && r.quantityMin <= quantity)
                .sort((a, b) => (b.quantityMin || 0) - (a.quantityMin || 0));

            if (applicableTiers.length > 0) {
                const tier = applicableTiers[0];
                if (tier.discountType === "percentage" && tier.discountValue) {
                    const discountAmount = subtotal * (tier.discountValue / 100);
                    subtotal -= discountAmount;
                } else if (tier.discountType === "fixed_amount" && tier.discountValue) {
                    subtotal -= tier.discountValue;
                }
            }
        }

        return subtotal * quantity;
    }

    async function handleAddToQuote() {
        if (!template) return;

        setSaving(true);
        setError(null);

        // Save configuration first
        const saveResult = await saveConfiguration({
            templateId: template.id,
            selectedOptions,
            quantity,
            notes: `Quote configuration for ${template.name}`,
        });

        if (saveResult.success && saveResult.data) {
            setCurrentConfigurationId(saveResult.data.id);
            onAddToQuote(saveResult.data);
            toast({
                title: "Added to quote",
                description: `${template.name} has been added to your quote.`,
            });
            handleClose();
        } else {
            setError(saveResult.error || "Failed to save configuration");
        }

        setSaving(false);
    }

    function handleLoadTemplate(config: Configuration) {
        const safeSelections: Record<string, string> = {};
        Object.entries(config.selectedOptions).forEach(([k, v]) => {
            safeSelections[k] = Array.isArray(v) ? v[0] : v;
        });
        setSelectedOptions(safeSelections);
        setQuantity(config.quantity);
        toast({
            title: "Template loaded",
            description: "Configuration loaded from template.",
        });
    }

    function handleClose() {
        setSelectedOptions({});
        setQuantity(1);
        setCurrentConfigurationId(null);
        onClose();
    }

    const totalPrice = calculateTotalPrice();
    const isValid = validation?.isValid ?? false;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{template?.name || "Configure Product"}</span>
                        <div className="flex gap-2">
                            <TemplateSelector
                                templateId={templateId}
                                onSelectTemplate={handleLoadTemplate}
                                trigger={
                                    <Button variant="outline" size="sm">
                                        <Package className="mr-2 h-4 w-4" />
                                        Load Template
                                    </Button>
                                }
                            />
                            {currentConfigurationId && (
                                <SaveTemplateDialog
                                    configurationId={currentConfigurationId}
                                    trigger={
                                        <Button variant="outline" size="sm">
                                            Save as Template
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </DialogTitle>
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

                {!loading && template && (
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                        {/* Base Info */}
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Base Price</p>
                                    <p className="text-2xl font-bold">${template.basePrice.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <div className="w-16 text-center">
                                        <p className="text-xs text-muted-foreground">Quantity</p>
                                        <p className="text-lg font-semibold">{quantity}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setQuantity(quantity + 1)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Option Groups */}
                        {optionGroups.map((group) => {
                            if (validation?.hiddenGroups.includes(group.id)) return null;

                            const groupErrors = validation?.errors.filter((e: ValidationMessage) => e.groupId === group.id && !e.optionId) || [];

                            return (
                                <div key={group.id} className="border rounded-lg p-4">
                                    <div className="mb-3">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            {group.name}
                                            {group.isRequired && (
                                                <span className="text-xs text-red-500">*</span>
                                            )}
                                        </h3>
                                        {group.description && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {group.description}
                                            </p>
                                        )}
                                        {groupErrors.map((err: ValidationMessage, i: number) => (
                                            <p key={i} className="text-sm text-destructive mt-1 font-medium">{err.message}</p>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {group.options.map((option) => {
                                            if (validation?.hiddenOptions.includes(option.id)) return null;

                                            const isSelected = selectedOptions[group.id] === option.id;
                                            const isDisabledByRule = validation?.disabledOptions.includes(option.id);
                                            const isDisabled = !option.isAvailable || isDisabledByRule;
                                            const optionError = validation?.errors.find((e: ValidationMessage) => e.groupId === group.id && e.optionId === option.id);

                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => handleOptionSelect(group.id, option.id)}
                                                    disabled={isDisabled}
                                                    className={`
                          text-left p-3 rounded-lg border-2 transition-all
                          ${isSelected
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/50"
                                                        }
                          ${isDisabled && "opacity-50 cursor-not-allowed"}
                          ${optionError && "border-destructive/50 bg-destructive/5"}
                        `}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium">{option.name}</p>
                                                            {option.description && (
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {option.description}
                                                                </p>
                                                            )}
                                                            {!option.isAvailable && option.availabilityNote && (
                                                                <p className="text-xs text-destructive mt-1">
                                                                    {option.availabilityNote}
                                                                </p>
                                                            )}
                                                            {isDisabledByRule && !isSelected && (
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    Not available with current selections
                                                                </p>
                                                            )}
                                                            {optionError && (
                                                                <p className="text-xs text-destructive mt-1 font-medium">
                                                                    {optionError.message}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right ml-2">
                                                            {option.priceModifierAmount !== 0 && (
                                                                <p className="text-sm font-semibold">
                                                                    {option.priceModifierType === "add" && "+"}
                                                                    ${option.priceModifierAmount.toFixed(2)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer with Total and Actions */}
                {!loading && template && (
                    <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Price</p>
                                <p className="text-3xl font-bold">${totalPrice.toFixed(2)}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddToQuote}
                                    disabled={!isValid || saving}
                                >
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add to Quote
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
