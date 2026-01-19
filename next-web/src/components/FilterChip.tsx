"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

interface FilterChipProps {
    field: string;
    value: string;
    onDelete: () => void;
    onChange: (newValue: string) => void;
}

// Predefined Options
const OPTIONS: Record<string, string[]> = {
    status: ['Lead', 'Customer', 'Churned'],
    role_name: ['CEO', 'CTO', 'VP Sales', 'Developer', 'Designer', 'Product Manager', 'HR Manager', 'Sales Rep', 'Customer Success', 'Employee'],
    joined_year: ['2023', '2024', '2025', '2026', '2027'],
    language_preference: ['Hebrew', 'English', 'French', 'German', 'Spanish', 'Dutch'],
    tags: ['Decision Maker', 'VIP', 'High Priority', 'Referral', 'Investor', 'Local']
};

export default function FilterChip({ field, value, onDelete, onChange }: FilterChipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const options = OPTIONS[field];
    const isEditable = !!options;

    // Parse values (Case Insensitive cleanup)
    const selectedValues = value.split(',').map(s => s.trim());

    // Toggle Handler
    const handleToggle = (opt: string) => {
        let newValues;

        // Find if exists (case insensitive)
        const exists = selectedValues.some(v => v.toLowerCase() === opt.toLowerCase());

        if (exists) {
            newValues = selectedValues.filter(v => v.toLowerCase() !== opt.toLowerCase());
        } else {
            newValues = [...selectedValues, opt];
        }

        if (newValues.length === 0) {
            onDelete();
        } else {
            onChange(newValues.join(','));
        }
    };

    const label = field.replace('_', ' ');
    const displayValue = selectedValues.length > 2
        ? `${selectedValues.length} selected`
        : value.replace(/,/g, ', ');

    return (
        <div className="relative group" ref={containerRef}>
            <span className={`
                flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary transition-colors
                ${isEditable ? 'hover:bg-primary/20 cursor-pointer' : ''}
            `}>
                <span onClick={() => isEditable && setIsOpen(!isOpen)} className="flex items-center gap-1">
                    <span className="font-normal opacity-70">{label}:</span>
                    <span className="font-bold truncate max-w-[150px]">{displayValue}</span>
                    {isEditable && <ChevronDown className="w-3 h-3 opacity-50" />}
                </span>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="ml-1 hover:text-foreground text-primary/60 hover:bg-primary/10 rounded-full p-0.5"
                >
                    <X className="w-3 h-3" />
                </button>
            </span>

            {/* Dropdown Popover */}
            {isOpen && isEditable && (
                <div className="absolute top-full mt-2 left-0 min-w-[200px] bg-card border border-border shadow-lg rounded-xl z-50 animate-in fade-in zoom-in-95 overflow-hidden flex flex-col p-1">
                    <div className="px-2 py-1.5 text-[10px] items-center text-muted-foreground font-semibold uppercase tracking-wider bg-secondary/30 rounded-t-lg mb-1 flex justify-between">
                        <span>Select {label}</span>
                        {selectedValues.length > 0 && (
                            <span className="text-primary cursor-pointer hover:underline" onClick={onDelete}>Clear</span>
                        )}
                    </div>
                    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5">
                        {options.map((opt) => {
                            const isSelected = selectedValues.some(v => v.toLowerCase() === opt.toLowerCase());
                            return (
                                <button
                                    key={opt}
                                    className={`
                                        text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center justify-between group/item
                                        ${isSelected
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'hover:bg-secondary text-foreground'}
                                    `}
                                    onClick={() => handleToggle(opt)}
                                >
                                    <span>{opt}</span>
                                    {isSelected && <span className="text-primary text-[10px] uppercase font-bold">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
