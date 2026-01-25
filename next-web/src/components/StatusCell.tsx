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

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        if (newStatus === status) return;

        startTransition(async () => {
            const payload = {
                id: personId,
                tenantId,
                customFields: { status: newStatus }
            };

            const res = await updatePerson(payload);
            if (res.success) {
                // Success - Server action revalidates path, Router syncs
                // router.refresh(); // redundant if action revalidates, but safe
            } else {
                console.error("Failed to update status", res.error);
                alert("Failed to update status"); // Simple feedback
            }
        });
    };

    return (
        <div className="relative group w-fit">
            {/* Display Badge */}
            <StatusBadge status={status} tenantId={tenantId} className={pending ? "opacity-50" : ""} />

            {/* Loading Indicator */}
            {pending && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                </div>
            )}

            {/* Invisible Select Overlay */}
            <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={status || ""}
                onChange={handleChange}
                disabled={pending}
                onClick={(e) => e.stopPropagation()} // Prevent row click
                title="Change Status"
            >
                <option value={status} disabled hidden>{status}</option>
                {/* Current Value Placeholder if options not loaded */}
                {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.payload?.label_i18n?.[language] || opt.label || opt.value}
                    </option>
                ))}
            </select>
        </div>
    );
}
