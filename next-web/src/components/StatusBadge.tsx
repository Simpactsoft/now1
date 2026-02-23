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
    options?: StatusOption[];
    code?: string; // Options API code
}

export function StatusBadge({ status, tenantId, className, options, code = "PERSON_STATUS" }: StatusBadgeProps) {
    const { language } = useLanguage();
    const [option, setOption] = useState<StatusOption | null>(null);

    useEffect(() => {
        if (!status) return;

        // 1. Use provided options if available
        if (options && options.length > 0) {
            const found = options.find(opt => opt.value.toLowerCase().trim() === status.toLowerCase().trim());
            if (found) {
                setOption(found);
                return;
            }
        }

        // 2. Check cache
        const cacheKey = `${tenantId}_${code}`;
        const cached = STATUS_CACHE[cacheKey];
        if (cached) {
            const found = cached.find(opt => opt.value.toLowerCase().trim() === status.toLowerCase().trim());
            if (found) setOption(found);
            return;
        }

        // Fetch if not in cache (once per tenant_code per session essentially)
        fetch(`/api/options?code=${code}&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) {
                    STATUS_CACHE[cacheKey] = json.data;
                    const found = json.data.find((opt: any) => opt.value.toLowerCase().trim() === status.toLowerCase().trim());
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
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap",
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
