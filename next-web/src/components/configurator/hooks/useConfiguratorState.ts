/**
 * Configurator state management hook.
 * Manages selections, validation, pricing, and server sync.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
    ProductTemplate,
    OptionGroup,
    ConfigurationRule,
    TemplatePreset,
} from "@/app/actions/cpq/template-actions";
import { validateConfigurationClientSide, type ValidationResult } from "./client-validation";
import { calculatePriceClientSide, type PriceCalculation } from "./client-pricing";
import { saveConfiguration, updateConfiguration } from "@/app/actions/cpq/configuration-actions";
import { validateConfiguration as validateOnServer } from "@/app/actions/cpq/validation-actions";
import { calculatePrice as calculateOnServer } from "@/app/actions/cpq/pricing-actions";

export interface ConfiguratorState {
    // Data
    template: ProductTemplate;
    optionGroups: OptionGroup[];
    rules: ConfigurationRule[];
    presets: TemplatePreset[];

    // Selections
    selections: Record<string, string | string[]>;
    quantity: number;

    // Validation
    validation: ValidationResult | null;
    isValidating: boolean;

    // Pricing
    pricing: PriceCalculation | null;
    isCalculating: boolean;

    // Saving
    configurationId: string | null;
    isSaving: boolean;

    // Actions
    selectOption: (groupId: string, optionId: string | string[]) => void;
    setQuantity: (quantity: number) => void;
    applyPreset: (presetId: string) => void;
    save: (notes?: string) => Promise<{ success: boolean; configId?: string }>;
    reset: () => void;
}

export function useConfiguratorState(
    template: ProductTemplate,
    optionGroups: OptionGroup[],
    rules: ConfigurationRule[],
    presets: TemplatePreset[],
    initialConfigId?: string
): ConfiguratorState {
    // Core state
    const [selections, setSelections] = useState<Record<string, string | string[]>>({});
    const [quantity, setQuantity] = useState(1);
    const [configurationId, setConfigurationId] = useState<string | null>(initialConfigId || null);

    // Derived state (client-side)
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [pricing, setPricing] = useState<PriceCalculation | null>(null);

    // Loading states
    const [isValidating, setIsValidating] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Client-side validation (instant)
    useEffect(() => {
        const result = validateConfigurationClientSide(optionGroups, selections, rules);
        setValidation(result);

        // Apply auto-selections from rules
        if (result.autoSelections && Object.keys(result.autoSelections).length > 0) {
            setSelections((prev) => ({ ...prev, ...result.autoSelections }));
        }
    }, [selections, optionGroups, rules]);

    // Client-side pricing (instant)
    useEffect(() => {
        const result = calculatePriceClientSide(
            template.basePrice,
            selections,
            optionGroups,
            quantity,
            rules
        );
        setPricing(result);
    }, [selections, quantity, template.basePrice, optionGroups, rules]);

    // Server validation (debounced, for authoritative check)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (Object.keys(selections).length === 0) return;

            setIsValidating(true);
            const result = await validateOnServer({
                templateId: template.id,
                selectedOptions: selections,
            });
            setIsValidating(false);

            // Update validation if server differs from client
            if (result.success && result.data) {
                if (JSON.stringify(result.data.errors) !== JSON.stringify(validation?.errors)) {
                    setValidation(result.data);
                }
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [selections, template.id]);

    // Server pricing (debounced, for authoritative pricing)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (Object.keys(selections).length === 0) return;

            setIsCalculating(true);
            const result = await calculateOnServer({
                templateId: template.id,
                selectedOptions: selections,
                quantity,
            });
            setIsCalculating(false);

            // Update pricing if server differs from client
            if (result.success && result.data) {
                if (Math.abs(result.data.total - (pricing?.total || 0)) > 0.01) {
                    setPricing(result.data);
                }
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [selections, quantity, template.id]);

    // Actions
    const selectOption = useCallback((groupId: string, optionId: string | string[]) => {
        setSelections((prev) => ({
            ...prev,
            [groupId]: optionId,
        }));
    }, []);

    const applyPreset = useCallback(
        (presetId: string) => {
            const preset = presets.find((p) => p.id === presetId);
            if (preset) {
                setSelections(preset.selectedOptions);
            }
        },
        [presets]
    );

    const save = useCallback(
        async (notes?: string) => {
            setIsSaving(true);

            const result = configurationId
                ? await updateConfiguration(configurationId, {
                    selectedOptions: selections,
                    quantity,
                    notes,
                })
                : await saveConfiguration({
                    templateId: template.id,
                    selectedOptions: selections,
                    quantity,
                    notes,
                    generateShareToken: true,
                });

            setIsSaving(false);

            if (result.success && result.data) {
                setConfigurationId(result.data.id);
                return { success: true, configId: result.data.id };
            }

            return { success: false };
        },
        [configurationId, selections, quantity, template.id]
    );

    const reset = useCallback(() => {
        setSelections({});
        setQuantity(1);
        setConfigurationId(null);
    }, []);

    return {
        template,
        optionGroups,
        rules,
        presets,
        selections,
        quantity,
        validation,
        isValidating,
        pricing,
        isCalculating,
        configurationId,
        isSaving,
        selectOption,
        setQuantity,
        applyPreset,
        save,
        reset,
    };
}
