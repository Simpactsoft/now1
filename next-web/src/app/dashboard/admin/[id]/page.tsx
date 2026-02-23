
import { fetchTenantDetails } from "@/app/actions/fetchTenantDetails";
import { ArrowLeft, Building2, Calendar, Mail, Shield, User } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function TenantDetailsPage({ params }: { params: { id: string } }) {
    // Await params for Next.js 15+ (if using dynamic params)
    const { id } = await params;

    // Fetch Data
    const response = await fetchTenantDetails(id);

    if (!response.success) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl text-destructive mb-2">Error Loading Workspace</h1>
                <p className="text-muted-foreground mb-4">{response.error || "Tenant not found"}</p>
                <Link href="/dashboard/admin" className="text-primary hover:underline">
                    &larr; Back to Admin
                </Link>
            </div>
        );
    }

    const tenant = response.data?.tenant;
    const users = response.data?.users;

    if (!tenant) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl text-destructive mb-2">Error Loading Workspace</h1>
                <p className="text-muted-foreground mb-4">Tenant not found</p>
                <Link href="/dashboard/admin" className="text-primary hover:underline">
                    &larr; Back to Admin
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/dashboard/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Workspaces</span>
                </Link>

                <div className="flex items-start justify-between p-6 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary/10 rounded-xl">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground mb-1">{tenant.name}</h1>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                                <span>ID: {tenant.id}</span>
                                <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">/{tenant.slug}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border 
                            ${tenant.status === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                            {tenant.status || 'Active'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Created {tenant.created_at ? formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true }) : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Users List (Main Column) */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        User Accounts
                        <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {users?.length || 0}
                        </span>
                    </h2>

                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <table className="w-full text-left">
                            <thead className="border-b border-border bg-muted/40">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Role</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Last Login</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users?.map((user: any) => (
                                    <tr key={user.user_id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center text-xs font-bold">
                                                    {user.email?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-foreground">{user.email}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{user.user_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-secondary rounded text-xs text-muted-foreground border border-border capitalize">
                                                {user.role || 'Member'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-muted-foreground">
                                            {user.last_sign_in_at ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true }) : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-muted-foreground">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {(!users || users.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
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
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Billing Status</h3>

                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-foreground capitalize">
                                {tenant.billing_status || 'Free'}
                            </span>
                            <Shield className="w-6 h-6 text-muted-foreground" />
                        </div>

                        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-[10%]"></div>
                        </div>
                        <p className="text-xs text-muted-foreground">Current Plan Usage (Mock)</p>
                    </div>

                    {/* Metadata Card */}
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">System Metadata</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
