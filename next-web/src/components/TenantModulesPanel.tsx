"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Layers, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import type { ModuleDefinition } from "@/app/actions/module-actions";

interface TenantModulesPanelProps {
    tenantId: string;
}

const CATEGORY_LABELS: Record<string, { en: string; he: string; color: string }> = {
    crm: { en: "CRM", he: "CRM", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    sales: { en: "Sales", he: "מכירות", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    erp: { en: "ERP", he: "ERP", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    admin: { en: "Admin", he: "ניהול", color: "text-green-500 bg-green-500/10 border-green-500/20" },
};

export default function TenantModulesPanel({ tenantId }: TenantModulesPanelProps) {
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    const fetchModules = useCallback(async () => {
        try {
            const { getTenantModules } = await import("@/app/actions/module-actions");
            const result = await getTenantModules(tenantId);
            if (result.success && result.data) {
                setModules(result.data);
            } else {
                toast.error("Failed to load modules");
            }
        } catch (e) {
            console.error("[TenantModulesPanel] Error:", e);
            toast.error("Error loading modules");
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    const handleToggle = async (moduleKey: string, currentEnabled: boolean) => {
        setToggling(moduleKey);
        try {
            const { updateTenantModule } = await import("@/app/actions/module-actions");
            const result = await updateTenantModule(tenantId, moduleKey, !currentEnabled);
            if (result.success) {
                // Update local state
                setModules(prev =>
                    prev.map(m =>
                        m.key === moduleKey
                            ? { ...m, is_enabled: !currentEnabled, has_override: true }
                            : m
                    )
                );
                toast.success(
                    !currentEnabled
                        ? `מודול "${modules.find(m => m.key === moduleKey)?.display_name_he}" הופעל`
                        : `מודול "${modules.find(m => m.key === moduleKey)?.display_name_he}" כובה`
                );
            } else {
                toast.error(result.error || "Failed to update module");
            }
        } catch (e) {
            console.error("[TenantModulesPanel] Toggle error:", e);
            toast.error("Error updating module");
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">Loading modules...</span>
            </div>
        );
    }

    if (modules.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No modules defined. Run the migration first.</p>
            </div>
        );
    }

    // Group modules by category
    const grouped = modules.reduce((acc, mod) => {
        if (!acc[mod.category]) acc[mod.category] = [];
        acc[mod.category].push(mod);
        return acc;
    }, {} as Record<string, ModuleDefinition[]>);

    const categoryOrder = ["crm", "sales", "erp", "admin"];

    return (
        <div className="space-y-6">
            {categoryOrder.map(cat => {
                const mods = grouped[cat];
                if (!mods || mods.length === 0) return null;
                const catInfo = CATEGORY_LABELS[cat] || { en: cat, he: cat, color: "text-muted-foreground" };

                return (
                    <div key={cat}>
                        {/* Category Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catInfo.color}`}>
                                {catInfo.he}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Module Rows */}
                        <div className="space-y-1">
                            {mods.map(mod => {
                                const isToggling = toggling === mod.key;

                                return (
                                    <div
                                        key={mod.key}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${mod.is_enabled
                                                ? "bg-card border-border hover:border-primary/30"
                                                : "bg-muted/30 border-border/50 opacity-70"
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium ${mod.is_enabled ? "text-foreground" : "text-muted-foreground"}`}>
                                                    {mod.display_name_he}
                                                </span>
                                                {mod.has_override && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                                                        שונה
                                                    </span>
                                                )}
                                                {!mod.default_enabled && !mod.has_override && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                        כבוי כברירת מחדל
                                                    </span>
                                                )}
                                            </div>
                                            {mod.description_he && (
                                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                    {mod.description_he}
                                                </p>
                                            )}
                                        </div>

                                        {/* Toggle */}
                                        <button
                                            onClick={() => handleToggle(mod.key, mod.is_enabled)}
                                            disabled={isToggling}
                                            className={`p-1 rounded-lg transition-all duration-200 ${isToggling
                                                    ? "opacity-50 cursor-wait"
                                                    : "hover:bg-secondary cursor-pointer"
                                                }`}
                                            title={mod.is_enabled ? "כבה מודול" : "הפעל מודול"}
                                        >
                                            {isToggling ? (
                                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                            ) : mod.is_enabled ? (
                                                <ToggleRight className="w-8 h-8 text-primary" />
                                            ) : (
                                                <ToggleLeft className="w-8 h-8 text-muted-foreground/40" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
