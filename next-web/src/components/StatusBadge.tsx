"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StatusOption {
    value: string;
    label: string;
    color?: string;
    payload?: any;
}

// Simple memory cache to avoid fetching on every badge render
const STATUS_CACHE: Record<string, StatusOption[]> = {};

interface StatusBadgeProps {
    status: string; // The raw code, e.g. "contacted" or "new"
    tenantId: string;
    className?: string;
}

export function StatusBadge({ status, tenantId, className }: StatusBadgeProps) {
    const { language } = useLanguage();
    const [option, setOption] = useState<StatusOption | null>(null);

    useEffect(() => {
        if (!status) return;

        // Check if we have options in cache
        const cached = STATUS_CACHE[tenantId];
        if (cached) {
            const found = cached.find(opt => opt.value === status);
            if (found) setOption(found);
            return;
        }

        // Fetch if not in cache (once per tenant per session essentially)
        // We fetch ALL options for this code (PERSON_STATUS) to be efficient for future badges
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) {
                    STATUS_CACHE[tenantId] = json.data;
                    const found = json.data.find((opt: any) => opt.value === status);
                    if (found) setOption(found);
                }
            })
            .catch(err => console.error("Failed to load status badge info", err));

    }, [status, tenantId]);

    // Fallback display if not loaded yet or not found
    const displayLabel = option?.payload?.label_i18n?.[language] || option?.label || status;
    const color = option?.color || "#94a3b8"; // Default slate-400

    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                className
            )}
            style={{
                backgroundColor: `${color}20`, // 12% opacity background
                color: color,
                borderColor: `${color}40`,
            }}
        >
            {displayLabel}
        </span>
    );
}
