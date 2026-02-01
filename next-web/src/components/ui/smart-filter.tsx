"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

interface SmartFilterProps {
    label: string;
    values: string[];
    options?: string[]; // Simple array of strings for now
    onChange: (newValues: string[]) => void;
    onRemove: () => void;
}

export function SmartFilter({ label, values, options = [], onChange, onRemove }: SmartFilterProps) {
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

    const isEditable = options.length > 0;

    // Toggle Handler
    const handleToggle = (opt: string) => {
        const exists = values.includes(opt);
        let newValues;

        if (exists) {
            newValues = values.filter(v => v !== opt);
        } else {
            newValues = [...values, opt];
        }

        if (newValues.length === 0) {
            onRemove();
        } else {
            onChange(newValues);
        }
    };

    const displayValue = values.length > 2
        ? `${values.length} selected`
        : values.join(', ');

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
                        onRemove();
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
                        <span className="text-primary cursor-pointer hover:underline" onClick={onRemove}>Clear</span>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5">
                        {options.map((opt) => {
                            const isSelected = values.includes(opt);
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
                                    {isSelected && <Check className="w-3 h-3" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
