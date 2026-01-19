
import { fetchTenantDetails } from "@/app/actions/fetchTenantDetails";
import { ArrowLeft, Building2, Calendar, Mail, Shield, User } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function TenantDetailsPage({ params }: { params: { id: string } }) {
    // Await params for Next.js 15+ (if using dynamic params)
    // Actually in Next 15 params is async.
    const { id } = await params;

    // Fetch Data
    const { success, tenant, users, error } = await fetchTenantDetails(id);

    if (!success || !tenant) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl text-red-500 mb-2">Error Loading Workspace</h1>
                <p className="text-zinc-500 mb-4">{error || "Tenant not found"}</p>
                <Link href="/dashboard/admin" className="text-indigo-400 hover:underline">
                    &larr; Back to Admin
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/dashboard/admin" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors w-fit">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Workspaces</span>
                </Link>

                <div className="flex items-start justify-between p-6 rounded-2xl bg-[#1C1C1E] border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-500/10 rounded-xl">
                            <Building2 className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">{tenant.name}</h1>
                            <div className="flex items-center gap-3 text-sm text-zinc-400 font-mono">
                                <span>ID: {tenant.id}</span>
                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">/{tenant.slug}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border 
                            ${tenant.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {tenant.status || 'Active'}
                        </span>
                        <span className="text-xs text-zinc-500">
                            Created {tenant.created_at ? formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true }) : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Users List (Main Column) */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-400" />
                        User Accounts
                        <span className="text-sm font-normal text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                            {users?.length || 0}
                        </span>
                    </h2>

                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E]/80 backdrop-blur-xl">
                        <table className="w-full text-left">
                            <thead className="border-b border-white/10 bg-white/5">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">User</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Role</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Last Login</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-zinc-400 uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users?.map((user: any) => (
                                    <tr key={user.user_id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
                                                    {user.email?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{user.email}</div>
                                                    <div className="text-[10px] text-zinc-500 font-mono">{user.user_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-zinc-300 border border-white/10 capitalize">
                                                {user.role || 'Member'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-400">
                                            {user.last_sign_in_at ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true }) : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-500">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {(!users || users.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 text-sm">
                                            No users found for this workspace.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sidebar (Details) */}
                <div className="space-y-6">
                    {/* Billing Card */}
                    <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/10 space-y-4">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Billing Status</h3>

                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-white capitalize">
                                {tenant.billing_status || 'Free'}
                            </span>
                            <Shield className="w-6 h-6 text-zinc-500" />
                        </div>

                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-[10%]"></div>
                        </div>
                        <p className="text-xs text-zinc-500">Current Plan Usage (Mock)</p>
                    </div>

                    {/* Metadata Card */}
                    <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/10 space-y-4">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">System Metadata</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <Calendar className="w-4 h-4" />
                                <span>Updated: {tenant.updated_at ? new Date(tenant.updated_at).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
