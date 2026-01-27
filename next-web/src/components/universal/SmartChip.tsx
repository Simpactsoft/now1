"use client";

import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { X, Check, ChevronDown } from "lucide-react";
import { FilterCondition } from "./ViewConfigContext";

interface SmartChipProps {
    filter: FilterCondition;
    onUpdate: (updates: Partial<FilterCondition>) => void;
    onRemove: () => void;
    dynamicOptions?: Record<string, any[]>;
}

const OPTIONS: Record<string, string[]> = {
    status: ['Lead', 'Customer', 'Churned'],
    role_name: ['CEO', 'CTO', 'VP Sales', 'Developer', 'Designer', 'Product Manager', 'HR Manager', 'Sales Rep', 'Customer Success', 'Employee'],
    joined_year: ['2023', '2024', '2025', '2026', '2027'],
    language_preference: ['Hebrew', 'English', 'French', 'German', 'Spanish', 'Dutch'],
    language_preference: ['Hebrew', 'English', 'French', 'German', 'Spanish', 'Dutch'],
    // tags: ['Decision Maker', 'VIP', 'High Priority', 'Referral', 'Investor', 'Local'], // Fetched dynamically or free text
    company_size: ['1-10', '11-50', '51-200', '201-500', '500+'],
    industry: ['Technology', 'Finance', 'Healthcare', 'Retail', 'Real Estate']
};

export default function SmartChip({ filter, onUpdate, onRemove, dynamicOptions = {} }: SmartChipProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (filter.defaultOpen) {
            // Small delay to ensure previous popover (Add Filter) clears focus
            const timer = setTimeout(() => setIsOpen(true), 100);
            return () => clearTimeout(timer);
        }
    }, [filter.defaultOpen]);
    const [tempValue, setTempValue] = useState(filter.value);

    // Options Logic
    let options: any[] = dynamicOptions[filter.field] || OPTIONS[filter.field];

    // Normalize options to simple string array if possible, or handle objects in render
    // For now, let's treat everything as strings for simple comparison, or support {value, label}
    const isEnum = !!options;

    // --- Enum Handlers ---
    const handleToggleOption = (opt: string) => {
        let currentValues = tempValue ? tempValue.split(',').map((s: string) => s.trim()) : [];
        const exists = currentValues.some((v: string) => v.toLowerCase() === opt.toLowerCase());

        let newValues;
        if (exists) {
            newValues = currentValues.filter((v: string) => v.toLowerCase() !== opt.toLowerCase());
        } else {
            newValues = [...currentValues, opt];
        }

        const newValueStr = newValues.join(',');
        setTempValue(newValueStr);
        // Auto-save for enum? Or keep explicit Apply? 
        // FilterChip did auto-apply. Let's do auto-apply for better UX here too, 
        // OR keep "Apply" button consistency. 
        // Let's keep manual Apply for now to match the "Edit" flow, or maybe auto-save is better?
        // Let's do manual Apply to avoid constant re-fetches while toggling multiple.
    };

    const handleSave = () => {
        onUpdate({ value: tempValue });
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
    };

    // Helper for display
    const getDisplayValue = () => {
        if (!filter.value) return '(Empty)';
        if (!isEnum) return filter.value;
        const count = filter.value.split(',').length;
        if (count > 1) return `${count} selected`;
        return filter.value;
    };

    return (
        <div className={`
            group flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border transition-all select-none
            ${filter.isEnabled
                ? 'bg-secondary/50 border-secondary-foreground/20 text-secondary-foreground'
                : 'bg-muted/50 border-border text-muted-foreground opacity-70 hover:opacity-100'}
        `}>
            {/* Toggle Checkbox */}
            <button
                onClick={() => onUpdate({ isEnabled: !filter.isEnabled })}
                className={`
                    w-4 h-4 rounded-sm border flex items-center justify-center transition-colors mr-1
                    ${filter.isEnabled ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50 hover:border-primary'}
                `}
            >
                {filter.isEnabled && <Check className="w-3 h-3" />}
            </button>

            {/* Main Chip Body (Trigger) */}
            <Popover.Root open={isOpen} onOpenChange={(open) => {
                setIsOpen(open);
                if (open) setTempValue(filter.value); // Reset temp on open
            }}>
                <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer outline-none focus-visible:ring-2 ring-ring">
                        <span className="opacity-70 uppercase tracking-wider text-[10px]">{filter.field.replace('_', ' ')}:</span>
                        <span className="font-bold truncate max-w-[150px]">{getDisplayValue()}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        className="w-[200px] bg-popover text-popover-foreground rounded-xl border shadow-lg p-0 z-50 animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 overflow-hidden"
                        align="start"
                        sideOffset={5}
                    >
                        {/* Header */}
                        <div className="bg-muted/50 px-3 py-2 border-b flex justify-between items-center">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{filter.field}</h4>
                            {tempValue && (
                                <button onClick={() => setTempValue('')} className="text-[10px] text-primary hover:underline">Clear</button>
                            )}
                        </div>

                        <div className="p-1 max-h-[250px] overflow-y-auto">
                            {/* [Fix] For Role & Tags, allow both Text Input AND List */}
                            {(isEnum && (filter.field === 'role_name' || filter.field === 'tags')) && (
                                <div className="p-2 border-b mb-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={filter.field === 'tags' ? "Type tag..." : "Type custom role..."}
                                        className="w-full bg-secondary border rounded-md px-2 py-1.5 text-sm focus:ring-2 ring-primary/20 outline-none"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1 px-1">Or select from list:</p>
                                </div>
                            )}

                            {isEnum ? (
                                <div className="flex flex-col gap-0.5">
                                    {options.filter(opt => {
                                        const valToCheck = typeof opt === 'string' ? opt : (opt.value || opt.label);
                                        // Filter logic: if typing in text box, filter options by the *current* typing (last after comma)
                                        if ((filter.field === 'role_name' || filter.field === 'tags') && tempValue) {
                                            const lastTerm = tempValue.split(',').pop()?.trim().toLowerCase() || '';
                                            if (!lastTerm) return true;
                                            return valToCheck.toLowerCase().includes(lastTerm);
                                        }
                                        return true;
                                    }).map((opt) => {
                                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label);
                                        const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);

                                        const currentValues = tempValue ? tempValue.split(',').map((s: string) => s.trim().toLowerCase()) : [];
                                        // Check against normalized value (we might need to be careful with case sensitivity here, sticking to lower for comparison)
                                        const isSelected = currentValues.includes(optValue.toLowerCase());

                                        // Handler
                                        const handleClick = () => {
                                            // Use the original casing for the value when adding
                                            handleToggleOption(optValue);
                                        }

                                        return (
                                            <button
                                                key={optValue}
                                                onClick={handleClick}
                                                className={`
                                                    flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-muted text-left transition-colors
                                                    ${isSelected ? 'text-primary font-medium bg-primary/5' : ''}
                                                `}
                                            >
                                                <span>{optLabel}</span>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Type to filter..."
                                        className="w-full bg-secondary border rounded-md px-2 py-1.5 text-sm focus:ring-2 ring-primary/20 outline-none"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-2 border-t bg-muted/20 flex justify-end gap-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-2 py-1 text-xs text-muted-foreground hover:bg-secondary rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 shadow-sm"
                            >
                                Apply Filter
                            </button>
                        </div>

                        <Popover.Arrow className="fill-popover" />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>

            {/* Remove Button */}
            <button
                onClick={onRemove}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
