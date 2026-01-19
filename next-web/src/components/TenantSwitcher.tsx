"use client";

import { useEffect, useState } from "react";
import { getTenants } from "@/app/actions/getTenants";
import { setTenantAction } from "@/app/actions/setTenant";

interface TenantSwitcherProps {
    currentTenantId?: string;
}

export default function TenantSwitcher({ currentTenantId }: TenantSwitcherProps) {
    const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTenants().then((data) => {
            setTenants(data);
            setLoading(false);
        });
    }, []);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        if (newId) {
            await setTenantAction(newId);
        }
    };

    if (loading) return <div className="text-zinc-500 animate-pulse">Loading Tenants...</div>;

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Active Tenant
            </label>
            <div className="relative">
                <select
                    value={currentTenantId}
                    onChange={handleChange}
                    className="w-full appearance-none bg-secondary/50 border border-border text-foreground rounded-lg pl-3 pr-10 py-2 outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-secondary/80"
                >
                    <option value="" className="bg-background text-foreground">Select a Tenant</option>
                    {tenants.map((t) => (
                        <option key={t.id} value={t.id} className="bg-background text-foreground">
                            {t.name}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
