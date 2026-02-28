"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ModulesContextType {
    /** Array of enabled module keys for the current tenant */
    enabledModules: string[];
    /** Whether modules have been loaded */
    loaded: boolean;
    /** Check if a specific module is enabled */
    isModuleEnabled: (moduleKey: string) => boolean;
    /** Refresh enabled modules from server */
    refresh: () => Promise<void>;
}

const ModulesContext = createContext<ModulesContextType>({
    enabledModules: [],
    loaded: false,
    isModuleEnabled: () => true,
    refresh: async () => { },
});

export function ModulesProvider({ children }: { children: React.ReactNode }) {
    const [enabledModules, setEnabledModules] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);

    const fetchModules = useCallback(async () => {
        try {
            const { getEnabledModules } = await import("@/app/actions/module-actions");
            const result = await getEnabledModules();
            if (result.success && result.data && result.data.length > 0) {
                setEnabledModules(result.data);
            } else {
                // If no modules returned (migration not applied or empty), allow all
                setEnabledModules([]);
            }
        } catch (e) {
            console.warn("[ModulesProvider] Failed to fetch modules, allowing all:", e);
            setEnabledModules([]);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    const isModuleEnabled = useCallback((moduleKey: string) => {
        // If not loaded yet or empty array (fallback), allow all modules
        if (!loaded || enabledModules.length === 0) return true;
        return enabledModules.includes(moduleKey);
    }, [enabledModules, loaded]);

    return (
        <ModulesContext.Provider value={{ enabledModules, loaded, isModuleEnabled, refresh: fetchModules }}>
            {children}
        </ModulesContext.Provider>
    );
}

export function useModules() {
    return useContext(ModulesContext);
}
