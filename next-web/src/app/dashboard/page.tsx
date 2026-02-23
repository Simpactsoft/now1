import { cookies } from "next/headers";
import EmployeesGrid from "@/components/EmployeesGrid";
import TenantSwitcher from "@/components/TenantSwitcher";
import PerformanceHUD from "@/components/PerformanceHUD";
import { Suspense } from "react";
import DashboardWrapper from "@/components/DashboardWrapper";
import { Activity, Database } from "lucide-react";
import { getSearchHistory } from "@/app/actions/searchHistory";
import RecentSearchesCard from "@/components/RecentSearchesCard";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "God Mode Dashboard | employeeOS",
    description: "High-performance employee data visualization",
};

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get("tenant_id")?.value;

    // Fetch Search History
    let history: string[] = [];
    if (tenantId) {
        const historyRes = await getSearchHistory(tenantId);
        if (historyRes.success && historyRes.data?.history) {
            history = historyRes.data.history;
        }
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-extrabold tracking-tight gradient-text">
                        Personnel Console
                    </h1>
                    <p className="text-zinc-500 text-sm">
                        Research Module: Unified Party Model Exploration
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <Suspense fallback={<div className="h-12 w-48 bg-zinc-900 animate-pulse rounded-md" />}>
                        <TenantSwitcher currentTenantId={tenantId} />
                    </Suspense>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Identities', value: '2.3M+', detail: 'Cards Table', color: 'text-blue-400' },
                    { label: 'Personnel', value: '1.6M', detail: 'People Table', color: 'text-emerald-400' },
                    { label: 'Managed Memberships', value: '100k', detail: 'Active Links', color: 'text-purple-400' },
                    { label: 'System Health', value: 'OPTIMAL', detail: 'Compute Small', color: 'text-amber-400' },
                ].map((stat, i) => (
                    <div key={i} className="glass p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                        <h3 className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</h3>
                        <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            {stat.detail}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Infrastructure - Spans 2 cols */}
                <div className="lg:col-span-2 glass p-8 rounded-3xl border border-white/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Activity className="text-brand-primary" size={20} />
                        Infrastructure Utilization
                    </h3>
                    <div className="h-48 flex items-end gap-2 px-4">
                        {[40, 65, 45, 90, 85, 40, 30, 60, 75, 50, 45, 70].map((h, i) => (
                            <div key={i} className="flex-1 bg-brand-primary/20 rounded-t-lg transition-all hover:bg-brand-primary/40 group relative" style={{ height: `${h}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    {h}%
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                        <span>12:00</span>
                        <span>14:00</span>
                        <span>16:00</span>
                        <span>18:00</span>
                    </div>
                </div>

                {/* Data Distribution - Spans 1 col */}
                <div className="glass p-8 rounded-3xl border border-white/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Database className="text-brand-secondary" size={20} />
                        Data Distribution
                    </h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Galactic Records', value: '1.35M', percent: 85 },
                            { label: 'Nano Records', value: '51', percent: 5 },
                            { label: 'System Cache', value: '250k', percent: 15 },
                        ].map((dist, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">{dist.label}</span>
                                    <span className="text-white font-mono">{dist.value}</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-secondary/40 rounded-full" style={{ width: `${dist.percent}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Searches - Spans 1 col */}
                <RecentSearchesCard history={history} />
            </div>
        </div>
    );
}
