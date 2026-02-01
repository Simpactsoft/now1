"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setTenantAction } from "@/app/actions/setTenant";

interface TenantSwitcherProps {
    currentTenantId?: string;
}

export default function TenantSwitcher({ currentTenantId }: TenantSwitcherProps) {
    const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // [Fallback] Known tenants dictionary to resolve names if RPC fails
    const KNOWN_TENANTS: Record<string, string> = {
        '00000000-0000-0000-0000-000000000003': 'Galactic Stress Test',
        '00000000-0000-0000-0000-000000000000': 'System Root',
        // Add others as needed
    };

    useEffect(() => {
        const fetchTenants = async () => {
            const supabase = createClient();
            console.log("[TenantSwitcher] Fetching tenants...");

            // Strat 1: Try V2 (New Migration)
            let { data, error } = await supabase.rpc("get_my_tenants_v2");

            if (error) {
                // Strat 2: Try V1 (Legacy / Standard)
                // console.warn("[TenantSwitcher] V2 failed, trying V1...");
                const resV1 = await supabase.rpc("get_my_tenants");
                if (!resV1.error && resV1.data) {
                    data = resV1.data;
                    error = null;
                } else {
                    // Both RPCs failed. This is expected if migration missing + old cache.
                    // We will rely on Fallback.
                    // console.debug("RPCs failed, relying on Client Fallback");
                }
            }

            // Strat 3: Client-Side Fallback (If RPC Dead but we have an ID)
            if (currentTenantId && KNOWN_TENANTS[currentTenantId]) {
                // If RPC failed OR returned empty but we know this ID
                if (error || !data || data.length === 0) {
                    console.log("[TenantSwitcher] Using Client Fallback for Tenant Name");
                    data = [{
                        id: currentTenantId,
                        name: KNOWN_TENANTS[currentTenantId],
                        slug: 'galactic-stress-test',
                        role: 'viewer'
                    }];
                    error = null;
                }
            }

            if (!error) {
                const list = data || [];
                console.log(`[TenantSwitcher] Found ${list.length} tenants.`);
                setTenants(list);

                // Auto-select logic
                if (list.length === 1) {
                    const single = list[0];
                    if (!currentTenantId || currentTenantId !== single.id) {
                        console.log("[TenantSwitcher] Auto-selecting single tenant:", single.name);
                        await setTenantAction(single.id);
                    }
                }
            } else {
                setTenants([]);
            }
            setLoading(false);
        };

        fetchTenants();
    }, [currentTenantId]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        if (newId) {
            await setTenantAction(newId);
        }
    };

    const currentTenantName = tenants.find(t => t.id === currentTenantId)?.name || KNOWN_TENANTS[currentTenantId || ''] || "Unknown Tenant";

    if (loading) return <div className="text-zinc-500 animate-pulse text-xs">Loading...</div>;

    if (tenants.length <= 1) {
        return (
            <div className="flex flex-col gap-3">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Current Organization
                    </label>
                    <div className="font-bold text-sm text-foreground truncate" title={currentTenantName}>
                        {tenants.length > 0 ? tenants[0].name : (currentTenantName === "Unknown Tenant" ? "No Organization" : currentTenantName)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Current Organization
                </label>
                <div className="font-bold text-sm text-foreground truncate" title={currentTenantName}>
                    {currentTenantName}
                </div>
            </div>

            <div className="relative">
                <select
                    value={currentTenantId}
                    onChange={handleChange}
                    className="w-full appearance-none bg-secondary/30 border border-border text-xs text-muted-foreground rounded-md pl-2 pr-8 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer hover:bg-secondary/50 hover:text-foreground"
                >
                    {tenants.map((t) => (
                        <option key={t.id} value={t.id} className="bg-background text-foreground">
                            {t.name}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-muted-foreground">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
