"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { updatePerson } from "@/app/actions/updatePerson";
import { Loader2, Pencil } from "lucide-react";

interface NameCellProps {
    firstName: string;
    lastName: string;
    personId: string;
    tenantId: string;
}

export function NameCell({ firstName, lastName, personId, tenantId }: NameCellProps) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const [value, setValue] = useState(fullName);
    const [isEditing, setIsEditing] = useState(false);
    const [pending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync prop changes
    useEffect(() => {
        setValue([firstName, lastName].filter(Boolean).join(" "));
    }, [firstName, lastName]);

    const handleSave = () => {
        if (value.trim() === [firstName, lastName].filter(Boolean).join(" ")) {
            setIsEditing(false);
            return;
        }

        const parts = value.trim().split(/\s+/);
        let newFirst = "";
        let newLast = "";

        if (parts.length > 0) {
            newFirst = parts[0];
            newLast = parts.slice(1).join(" ");
        }

        // Fallback for Last Name requirement
        if (!newLast) newLast = "-"; // or "." or maintain previous if we want to be clever, but "-" is visible.

        // Actually, if user clears name, what happens? Schema says min 1 char.
        if (!newFirst) return; // Don't save empty name for now.

        startTransition(async () => {
            const payload = {
                id: personId,
                tenantId,
                firstName: newFirst,
                lastName: newLast
            };

            const res = await updatePerson(payload);
            if (!res.success) {
                console.error("Failed to update name", res.error);
                setValue([firstName, lastName].filter(Boolean).join(" ")); // Revert
                alert("Failed to update name: " + res.error);
            }
            setIsEditing(false);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setValue([firstName, lastName].filter(Boolean).join(" "));
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="relative w-full min-w-[150px]">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className={`w-full px-2 py-1 text-sm font-semibold border border-primary rounded shadow-sm outline-none bg-background`}
                />
                {pending && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`
                group cursor-pointer -ml-2 px-2 py-1 rounded hover:bg-accent border border-transparent transition-colors flex items-center min-h-[32px] relative
                ${pending ? 'opacity-50 pointer-events-none' : ''}
            `}
            title="Click to edit name"
        >
            {/* Hover Overlay with Icon */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground/70" />
            </div>

            <span className="relative font-semibold text-foreground truncate select-none pr-6">
                {value || "Unknown"}
            </span>
            {pending && <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />}
        </div >
    );
}
