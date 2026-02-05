
"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil, ChevronDown } from "lucide-react";

interface EditableFieldProps {
    value: string;
    onSave: (newValue: string) => Promise<void>;
    label?: string;
    type?: "text" | "email" | "tel" | "select";
    className?: string; // Class for the display text
    inputClassName?: string; // Class for the input
    placeholder?: string;
    style?: React.CSSProperties; // Pass through styles
    isMultiline?: boolean;
    options?: { value: string; label: string }[];
}

export default function EditableField({
    value,
    onSave,
    label,
    type = "text",
    className = "",
    inputClassName = "",
    placeholder,
    style,
    isMultiline = false,
    ...props
}: EditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [optimisticValue, setOptimisticValue] = useState(value);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync external changes
    useEffect(() => {
        setTempValue(value);
        setOptimisticValue(value);
        setError(null);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (tempValue === value) {
            setIsEditing(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await onSave(tempValue);
            setOptimisticValue(tempValue); // Optimistic update
            setIsEditing(false);
        } catch (err: any) {
            console.error("Failed to save", err);
            setError(err?.message || "Failed to save");
            // Do not close editing mode so user can fix it
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setTempValue(value);
        setError(null);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempValue(e.target.value);
        if (error) setError(null); // Clear error on edit
    };

    if (isEditing) {
        return (
            <div className="flex flex-col gap-1 min-w-[150px]" style={style}>
                <div className="relative w-full">
                    {type === 'select' ? (
                        <select
                            ref={inputRef as any}
                            value={tempValue}
                            onChange={(e) => {
                                setTempValue(e.target.value);
                                if (error) setError(null);
                            }}
                            onBlur={() => handleSave()}
                            onKeyDown={handleKeyDown}
                            className={`w-full bg-background border ${error ? 'border-destructive' : 'border-input focus:border-primary'} rounded px-2 py-1 text-foreground outline-none focus:ring-1 ${error ? 'focus:ring-destructive' : 'focus:ring-primary'} ${inputClassName}`}
                        >
                            <option value="" disabled>Select {label}</option>
                            {(props.options || []).map((opt: any) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            ref={inputRef}
                            type={type}
                            value={tempValue}
                            onChange={handleChange}
                            onBlur={() => {
                                // Only save on blur if no error exists yet? 
                                // Or try to save. If it fails, error shows.
                                // Risk: Blur loop if error shows?
                                // If we show error, input might move.
                                // Let's rely on Enter/Explicit save or careful blur.
                                // For now, keep blur-save but with NO alert.
                                handleSave();
                            }}
                            onKeyDown={handleKeyDown}
                            className={`w-full bg-background border ${error ? 'border-destructive' : 'border-input focus:border-primary'} rounded px-2 py-1 text-foreground outline-none focus:ring-1 ${error ? 'focus:ring-destructive' : 'focus:ring-primary'} ${inputClassName}`}
                            placeholder={placeholder || label}
                        />
                    )}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        {isLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                    </div>
                </div>
                {error && <span className="text-xs text-red-400 px-1">{error}</span>}
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`group/edit cursor-pointer relative hover:bg-white/5 rounded px-1 -mx-1 transition-colors flex items-center gap-2 ${className}`}
            title="Click to edit"
            style={style}
        >
            <span className={isMultiline ? "break-words whitespace-normal" : "truncate"}>{optimisticValue || <span className="text-slate-500 italic">Empty</span>}</span>
            {type === 'select' ? (
                <ChevronDown className="w-3 h-3 text-slate-500 opacity-50 group-hover/edit:opacity-100 transition-opacity shrink-0" />
            ) : (
                <Pencil className="w-3 h-3 text-slate-500 opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
            )}
        </div>
    );
}
