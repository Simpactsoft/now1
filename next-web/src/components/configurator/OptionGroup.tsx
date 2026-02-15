"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OptionGroup as OptionGroupType, Option } from "@/app/actions/cpq/template-actions";
import { AlertCircle } from "lucide-react";

interface OptionGroupProps {
    group: OptionGroupType;
    selectedValue: string | string[] | undefined;
    onChange: (value: string | string[]) => void;
    errors?: Array<{ groupId: string | null; message: string }>;
    disabledOptions?: string[];
    hiddenOptions?: string[];
}

/**
 * OptionGroup - Renders a single option group (radio or checkboxes).
 * Displays price differentials and applies validation states.
 */
export function OptionGroupComponent({
    group,
    selectedValue,
    onChange,
    errors = [],
    disabledOptions = [],
    hiddenOptions = [],
}: OptionGroupProps) {
    const groupErrors = errors.filter((e) => e.groupId === group.id);
    const visibleOptions = group.options.filter((opt) => !hiddenOptions.includes(opt.id));

    const handleRadioChange = (value: string) => {
        onChange(value);
    };

    const handleCheckboxChange = (optionId: string, checked: boolean) => {
        const current = Array.isArray(selectedValue) ? selectedValue : selectedValue ? [selectedValue] : [];
        if (checked) {
            onChange([...current, optionId]);
        } else {
            onChange(current.filter((id) => id !== optionId));
        }
    };

    return (
        <Card className="p-6">
            <div className="space-y-4">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{group.name}</h3>
                        {group.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                                Required
                            </Badge>
                        )}
                        {group.sourceType === "category" && (
                            <Badge variant="outline" className="text-xs">
                                Dynamic
                            </Badge>
                        )}
                    </div>
                    {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                </div>

                {/* Errors */}
                {groupErrors.length > 0 && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {groupErrors.map((err, idx) => (
                                <div key={idx}>{err.message}</div>
                            ))}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Options - Radio */}
                {group.selectionType === "single" && (
                    <RadioGroup
                        value={typeof selectedValue === "string" ? selectedValue : undefined}
                        onValueChange={handleRadioChange}
                    >
                        {visibleOptions.map((option) => {
                            const isDisabled = disabledOptions.includes(option.id) || !option.isAvailable;
                            const priceLabel =
                                option.priceModifierType === "add" && option.priceModifierAmount !== 0
                                    ? option.priceModifierAmount > 0
                                        ? `+$${option.priceModifierAmount.toFixed(0)}`
                                        : `-$${Math.abs(option.priceModifierAmount).toFixed(0)}`
                                    : option.priceModifierType === "replace"
                                        ? `$${option.priceModifierAmount.toFixed(0)}`
                                        : null;

                            return (
                                <label
                                    key={option.id}
                                    htmlFor={option.id}
                                    className={`flex items-start space-x-3 p-3 rounded-md border ${selectedValue === option.id ? "border-primary bg-primary/5" : "border-border"
                                        } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}
                                >
                                    <RadioGroupItem value={option.id} id={option.id} disabled={isDisabled} className="mt-1" />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{option.name}</span>
                                            {priceLabel && (
                                                <span className="text-sm font-semibold text-primary">{priceLabel}</span>
                                            )}
                                        </div>
                                        {option.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                                        )}
                                        {option.availabilityNote && (
                                            <p className="text-xs text-yellow-600 mt-1">{option.availabilityNote}</p>
                                        )}
                                    </div>
                                </label>
                            );
                        })}
                    </RadioGroup>
                )}

                {/* Options - Checkboxes */}
                {group.selectionType === "multiple" && (
                    <div className="space-y-2">
                        {visibleOptions.map((option) => {
                            const isDisabled = disabledOptions.includes(option.id) || !option.isAvailable;
                            const isChecked = Array.isArray(selectedValue)
                                ? selectedValue.includes(option.id)
                                : selectedValue === option.id;
                            const priceLabel =
                                option.priceModifierAmount !== 0
                                    ? `+$${option.priceModifierAmount.toFixed(0)}`
                                    : null;

                            return (
                                <div
                                    key={option.id}
                                    className={`flex items-start space-x-3 p-3 rounded-md border ${isChecked ? "border-primary bg-primary/5" : "border-border"
                                        } ${isDisabled ? "opacity-50" : "cursor-pointer hover:bg-accent"}`}
                                    onClick={() => !isDisabled && handleCheckboxChange(option.id, !isChecked)}
                                >
                                    <Checkbox
                                        id={option.id}
                                        checked={isChecked}
                                        disabled={isDisabled}
                                        onCheckedChange={(checked) =>
                                            handleCheckboxChange(option.id, checked as boolean)
                                        }
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <Label
                                            htmlFor={option.id}
                                            className={`flex items-center justify-between ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                                                }`}
                                        >
                                            <span className="font-medium">{option.name}</span>
                                            {priceLabel && (
                                                <span className="text-sm font-semibold text-primary">{priceLabel}</span>
                                            )}
                                        </Label>
                                        {option.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Selection count for multi-select */}
                {group.selectionType === "multiple" && (
                    <div className="text-xs text-muted-foreground">
                        {Array.isArray(selectedValue) ? selectedValue.length : 0} of{" "}
                        {group.maxSelections || "unlimited"} selected
                        {group.minSelections > 0 && ` (min: ${group.minSelections})`}
                    </div>
                )}
            </div>
        </Card>
    );
}
