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

    // Separate Selection State from Search State
    const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    // Sync from props when opening
    useEffect(() => {
        if (isOpen) {
            const initial = filter.value ? filter.value.split(',').map(s => s.trim()).filter(Boolean) : [];
            setSelectedValues(new Set(initial));
            setSearchTerm('');
        }
    }, [isOpen, filter.value]);

    useEffect(() => {
        if (filter.defaultOpen) {
            const timer = setTimeout(() => setIsOpen(true), 100);
            return () => clearTimeout(timer);
        }
    }, [filter.defaultOpen]);

    // Options Logic
    let options: any[] = (dynamicOptions[filter.field] && dynamicOptions[filter.field].length > 0)
        ? dynamicOptions[filter.field]
        : OPTIONS[filter.field];

    const isEnum = !!options && options.length > 0;

    // --- Handlers ---
    const handleToggleOption = (opt: string) => {
        const next = new Set(selectedValues);
        // Case-insensitive check to avoid duplicates if casing differs
        const existing = Array.from(next).find(v => v.toLowerCase() === opt.toLowerCase());

        if (existing) {
            next.delete(existing);
        } else {
            next.add(opt);
        }
        setSelectedValues(next);
        // Keep search term open to allow multiple selections? 
        // Or clear search term? Let's keep it to allow "Select All matches" workflow if we had it, 
        // but for single toggle, usually keep it or clear it.
        // Let's clear search term if it was an exact match, otherwise keep it.
        // Actually, better UX: keep input focus, keep search term.
    };

    const handleSave = () => {
        const val = Array.from(selectedValues).join(',');
        onUpdate({ value: val });
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // If there is a search term and it's not empty
            if (searchTerm.trim()) {
                // Add as custom value
                const next = new Set(selectedValues);
                next.add(searchTerm.trim());
                setSelectedValues(next);
                setSearchTerm(''); // Clear input after adding
            } else {
                // If empty search, submit form
                handleSave();
            }
        }
    };

    // Helper for display (Trigger Button)
    const getDisplayValue = () => {
        if (!filter.value) return '(Empty)';
        if (!isEnum && !filter.value.includes(',')) return filter.value;
        const count = filter.value.split(',').filter(Boolean).length;
        if (count > 1) return `${count} selected`;
        return filter.value;
    };

    // Filter Options based on Search Term
    const filteredOptions = options ? options.filter(opt => {
        if (!searchTerm) return true;
        const valToCheck = typeof opt === 'string' ? opt : (opt.value || opt.label);
        return valToCheck.toLowerCase().includes(searchTerm.toLowerCase());
    }) : [];

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
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <Popover.Trigger asChild>
                    <button className="flex items-center gap-2 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 px-2 py-0.5 rounded cursor-pointer outline-none focus-visible:ring-2 ring-ring">
                        <span className="opacity-70 uppercase tracking-wider text-[10px]">{filter.field.replace('_', ' ')}:</span>
                        <span className="font-bold truncate max-w-[150px]">{getDisplayValue()}</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        className="w-[220px] bg-popover text-popover-foreground rounded-xl border shadow-lg p-0 z-50 animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 overflow-hidden"
                        align="start"
                        sideOffset={5}
                    >
                        {/* Header */}
                        <div className="bg-muted/50 px-3 py-2 border-b flex justify-between items-center">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{filter.field}</h4>
                            {selectedValues.size > 0 && (
                                <button onClick={() => setSelectedValues(new Set())} className="text-[10px] text-primary hover:underline">Clear All</button>
                            )}
                        </div>

                        <div className="p-1 max-h-[300px] overflow-y-auto">
                            {/* Input / Search Box */}
                            <div className="p-2 border-b mb-1 sticky top-0 bg-popover z-10">

                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={isEnum ? "Search..." : "Type value..."}
                                    className="w-full bg-secondary border rounded-md px-2 py-1.5 text-sm focus:ring-2 ring-primary/20 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {isEnum && <p className="text-[10px] text-muted-foreground mt-1 px-1">Select from list or type & enter to add custom.</p>}
                            </div>

                            {/* Selected Chips (if any, to see what's picked) */}
                            {selectedValues.size > 0 && (
                                <div className="px-2 py-1 flex flex-wrap gap-1 border-b mb-1">
                                    {Array.from(selectedValues).map(val => (
                                        <span key={val} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                                            {val}
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleToggleOption(val);
                                                }}
                                                className="hover:text-red-500"
                                            >
                                                <X className="w-2 h-2" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Options List */}
                            {isEnum ? (
                                <div className="flex flex-col gap-0.5">
                                    {filteredOptions.length === 0 && searchTerm && (
                                        <button
                                            onClick={() => {
                                                const next = new Set(selectedValues);
                                                next.add(searchTerm.trim());
                                                setSelectedValues(next);
                                                setSearchTerm('');
                                            }}
                                            className="px-2 py-2 text-xs text-left italic hover:bg-muted text-muted-foreground"
                                        >
                                            Adding "{searchTerm}"...
                                        </button>
                                    )}


                                    {filteredOptions.map((opt) => {
                                        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label);
                                        const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);

                                        // Check selection
                                        const isSelected = Array.from(selectedValues).some(v => v.toLowerCase() === optValue.toLowerCase());

                                        return (
                                            <button
                                                key={optValue}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleToggleOption(optValue);
                                                }}
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
                            ) : null}
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
                                Apply ({selectedValues.size})
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
