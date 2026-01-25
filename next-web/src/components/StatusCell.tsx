"use client";

import { useState, useEffect, useTransition } from "react";
import { StatusBadge } from "./StatusBadge";
import { updatePerson } from "@/app/actions/updatePerson";
import { useLanguage } from "@/context/LanguageContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface StatusOption {
    value: string;
    label: string;
    payload?: any;
}

interface StatusCellProps {
    status: string;
    personId: string;
    tenantId: string;
    statusOptions: StatusOption[];
}

export function StatusCell({ status, personId, tenantId, statusOptions }: StatusCellProps) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const { language } = useLanguage();

    // Optimistic State
    const [currentStatus, setCurrentStatus] = useState(status);

    // Normalize: Lowercase, Trim, AND replace underscores with spaces
    // This handles "NEW_LEAD" (Code) matching "New Lead" (DB value)
    const normalize = (val: string | null | undefined) => {
        if (!val) return '';
        return val.trim().toLowerCase().replace(/_/g, ' ');
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value; // This matches option value (RAW CODE)

        // Find the OPTION that was selected to get its raw Code
        // (Value is already code, but let's be sure)
        // If normalization matches, we use the option's value.

        const rawCode = statusOptions.find(o => o.value === selectedValue)?.value || selectedValue;

        // Check against current status (normalized)
        if (normalize(rawCode) === normalize(currentStatus)) return;

        // Optimistic Update
        // Ensure we set the OPTIMISTIC value to something that the SELECT can display
        // Since SELECT uses normalize(val) for comparison? No, I need to update render logic first.
        setCurrentStatus(rawCode);

        startTransition(async () => {
            const payload = {
                id: personId,
                tenantId,
                customFields: { status: rawCode } // Save the CODE
            };

            const res = await updatePerson(payload);
            if (!res.success) {
                console.error("Failed to update status", res.error);
                alert("Failed to update status");
                setCurrentStatus(status); // Revert
            }
        });
    };

    return (
        <div className="relative group w-fit">
            {/* Display Badge (Use currentStatus) */}
            <StatusBadge status={currentStatus} tenantId={tenantId} className={pending ? "opacity-50" : ""} />

            {/* Loading Indicator */}
            {pending && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                </div>
            )}

            {/* Invisible Select Overlay */}
            <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={normalize(currentStatus)} // Select value is normalized for comparison
                onChange={handleChange}
                disabled={pending}
                onClick={(e) => e.stopPropagation()} // Prevent row click
                title="Change Status"
            >
                {/* Placeholder option, its value is normalized for comparison, but it's disabled/hidden */}
                <option value={normalize(currentStatus)} disabled hidden>{currentStatus}</option>
                {/* Current Value Placeholder if options not loaded */}
                {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}> {/* Option value is RAW code */}
                        {opt.payload?.label_i18n?.[language] || opt.label || opt.value}
                    </option>
                ))}
            </select>
        </div>
    );
}
