"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchOrgAnalytics, fetchTenantSummary } from "@/app/actions/fetchAnalytics";
import { Users, DollarSign, LayoutDashboard, ArrowUpRight, TrendingUp } from "lucide-react";

interface AnalyticsDashboardProps {
    tenantId: string;
}

export default function AnalyticsDashboard({ tenantId }: AnalyticsDashboardProps) {
    const [summary, setSummary] = useState<any>(null);
    const [deptStats, setDeptStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!tenantId) return;

        setLoading(true);
        const loadData = async () => {
            const [sumRes, deptRes] = await Promise.all([
                fetchTenantSummary(tenantId),
                fetchOrgAnalytics(tenantId, ""),
            ]);

            if (sumRes.success && sumRes.data) setSummary(sumRes.data.data);
            if (deptRes.success && deptRes.data) setDeptStats(deptRes.data.data);
            setLoading(false);
        };

        startTransition(() => {
            loadData();
        });
    }, [tenantId]);

    if (!tenantId) return null;

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-32 animate-pulse" />
                ))}
            </div>
        );
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

    const formatNumber = (val: number) =>
        new Intl.NumberFormat("en-US").format(val);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={64} className="text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Headcount</p>
                    <div className="flex items-end gap-3">
                        <h3 className="text-3xl font-bold text-white">{formatNumber(summary?.total_employees || 0)}</h3>
                        <span className="text-emerald-500 text-sm font-medium flex items-center mb-1">
                            Active <ArrowUpRight size={14} className="ml-1" />
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        Organization-wide employee count across all branches.
                    </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={64} className="text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Annual Payroll</p>
                    <div className="flex items-end gap-3">
                        <h3 className="text-3xl font-bold text-white">{formatCurrency(summary?.total_payroll || 0)}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        Total annual expenditure on salaries and benefits.
                    </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group hover:border-violet-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={64} className="text-violet-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-1">Avg Salary</p>
                    <div className="flex items-end gap-3">
                        <h3 className="text-3xl font-bold text-white">{formatCurrency(summary?.avg_salary || 0)}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        Average employee compensation organized by hierarchy.
                    </p>
                </div>
            </div>

            {/* Hierarchical Breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="border-b border-zinc-800 p-6 bg-zinc-900/50">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <LayoutDashboard size={20} className="text-blue-500" /> Organization Distribution
                    </h4>
                    <p className="text-sm text-zinc-500 mt-1">Breakdown by Level-1 Org Units</p>
                </div>
                <div className="p-6">
                    <div className="space-y-6">
                        {deptStats.map((dept: any) => {
                            const share = summary?.total_employees > 0
                                ? (dept.total_employees_in_branch / summary.total_employees) * 100
                                : 0;

                            return (
                                <div key={dept.sub_path} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-zinc-300">{dept.sub_path}</span>
                                        <span className="text-zinc-500">
                                            {formatNumber(dept.total_employees_in_branch)} emps ({share.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500/80 rounded-full transition-all duration-1000"
                                            style={{ width: `${share}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
