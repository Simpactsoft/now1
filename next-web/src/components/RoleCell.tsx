"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { updatePerson } from "@/app/actions/updatePerson";
import { Loader2 } from "lucide-react";

interface RoleCellProps {
    role: string;
    personId: string;
    tenantId: string;
}

export function RoleCell({ role, personId, tenantId }: RoleCellProps) {
    const [value, setValue] = useState(role || "");
    const [isEditing, setIsEditing] = useState(false);
    const [pending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync prop changes if they come from outside
    useEffect(() => {
        setValue(role || "");
    }, [role]);

    const handleSave = () => {
        // If no change, just exit edit mode
        if (value === (role || "")) {
            setIsEditing(false);
            return;
        }

        startTransition(async () => {
            const payload = {
                id: personId,
                tenantId,
                customFields: { role: value }
            };

            const res = await updatePerson(payload);
            if (!res.success) {
                console.error("Failed to update role", res.error);
                // Revert on failure
                setValue(role || "");
                alert("Failed to update role");
            }
            setIsEditing(false);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setValue(role || "");
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="relative w-full max-w-[200px]">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full px-2 py-1 text-sm border border-primary rounded shadow-sm outline-none bg-background"
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
            onClick={() => setIsEditing(true)}
            className={`
                group cursor-pointer px-2 py-1 -ml-2 rounded hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-colors min-h-[28px] flex items-center
                ${pending ? 'opacity-50 pointer-events-none' : ''}
            `}
            title="Click to edit role"
        >
            <span className={value ? "text-foreground" : "text-muted-foreground italic text-xs"}>
                {value || "Add role..."}
            </span>
            {pending && <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />}
        </div>
    );
}
