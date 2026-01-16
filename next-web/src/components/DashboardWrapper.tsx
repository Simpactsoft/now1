"use client";

import { useState, useCallback } from "react";
import EmployeesGrid from "./EmployeesGrid";
import PerformanceHUD from "./PerformanceHUD";
import AnalyticsDashboard from "./AnalyticsDashboard";

interface DashboardWrapperProps {
    tenantId: string;
}

export default function DashboardWrapper({ tenantId }: DashboardWrapperProps) {
    const [metrics, setMetrics] = useState({ latency: 0, totalRows: 0 });

    const handleDataFetch = useCallback((latency: number, totalRows: number) => {
        setMetrics({ latency, totalRows });
    }, []);

    return (
        <>
            <PerformanceHUD latency={metrics.latency} totalRows={metrics.totalRows} />

            <AnalyticsDashboard tenantId={tenantId} />

            <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl overflow-hidden shadow-canvas">

                <EmployeesGrid
                    tenantId={tenantId}
                    onDataFetch={handleDataFetch}
                />
            </div>

            <footer className="flex items-center justify-between text-[11px] text-zinc-700 px-2 uppercase tracking-widest font-mono">
                <span>SSRM Cache Active</span>
                <span>Real-time PostgREST Stream</span>
            </footer>
        </>
    );
}
