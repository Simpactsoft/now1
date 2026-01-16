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
            <select
                value={currentTenantId}
                onChange={handleChange}
                className="bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
                <option value="">Select a Tenant</option>
                {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
