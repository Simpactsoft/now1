"use client";

import { useState, useEffect } from "react";
import { fetchUsers } from "@/app/actions/fetchUsers";
import { inviteUser } from "@/app/actions/inviteUser";
import { toast } from "sonner";
import { UserPlus, Mail, Shield, Trash2, Check, X, MoreHorizontal, Building2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

export default function UserManagement({ tenantId }: { tenantId?: string }) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    // Invite State
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<'distributor' | 'dealer' | 'agent'>('agent');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (tenantId) loadUsers();
    }, [tenantId]);

    const loadUsers = async () => {
        setLoading(true);
        const res = await fetchUsers(tenantId!);
        if (res.success) {
            setUsers(res.users);
        } else {
            setPageError(res.error || "Failed to load users");
        }
        setLoading(false);
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setInviting(true);
        try {
            const res = await inviteUser(inviteEmail, inviteRole, tenantId!);
            if (res.success) {
                toast.success("Invitation sent successfully!");
                setIsInviteOpen(false);
                setInviteEmail("");
                loadUsers(); // Refresh list
            } else {
                toast.error(res.error || "Failed to send invitation");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setInviting(false);
        }
    };

    // Group Users by Tenant
    const groupedUsers = users.reduce((acc, user) => {
        // user.tenants is an object { name: ... } from the join
        const tName = user.tenants?.name || "Unknown Organization";
        if (!acc[tName]) acc[tName] = [];
        acc[tName].push(user);
        return acc;
    }, {} as Record<string, typeof users>);

    if (pageError) {
        return <div className="p-8 text-center text-destructive">{pageError}</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold">Team Members</h2>
                    <p className="text-sm text-muted-foreground">Manage users across organizations</p>
                </div>
                <button
                    onClick={() => setIsInviteOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
                >
                    <UserPlus size={16} />
                    Invite Member
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p>Loading team structure...</p>
                </div>
            ) : Object.keys(groupedUsers).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-muted rounded-xl bg-muted/10">
                    <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">No team members found</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        Get started by inviting your first team member to collaborate.
                    </p>
                </div>
            ) : (
                <div className="grid gap-8">
                    {Object.entries(groupedUsers).map(([tenantName, tenantUsers]) => (
                        <div key={tenantName} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-none">{tenantName}</h3>
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {tenantUsers.length} members
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {tenantUsers.map((user: any) => (
                                    <div key={user.id} className="relative p-5 rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col gap-4 group hover:border-blue-500/30 hover:shadow-md transition-all">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-muted border-2 border-background shadow-sm flex items-center justify-center text-secondary-foreground font-bold text-lg shrink-0">
                                                    {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm truncate max-w-[120px]" title={`${user.first_name} ${user.last_name}`}>
                                                        {user.first_name} {user.last_name}
                                                    </div>
                                                    <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-0.5">
                                                        {user.role}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} title={user.status} />
                                        </div>

                                        <div className="pt-3 mt-auto border-t border-border/50 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground" title={user.email}>
                                                <Mail className="w-3 h-3" />
                                                <span className="truncate">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Shield className="w-3 h-3" />
                                                <span className="capitalize">{user.role} Access</span>
                                            </div>
                                        </div>

                                        {/* Actions Menu (Hidden for now, but ready) */}
                                        <button className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Invite Dialog */}
            <Dialog.Root open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background p-0 rounded-2xl shadow-2xl z-50 border border-border animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-border bg-muted/30">
                            <Dialog.Title className="text-xl font-bold">Invite Team Member</Dialog.Title>
                            <Dialog.Description className="text-sm text-muted-foreground mt-1">
                                Send an invitation link to add a new user to <span className="font-medium text-foreground">{Object.keys(groupedUsers)[0] || 'your organization'}</span>.
                            </Dialog.Description>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="colleague@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Access Role</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {(['agent', 'dealer', 'distributor'] as const).map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setInviteRole(role)}
                                            className={`relative flex items-center p-3 rounded-xl border transition-all text-left group ${inviteRole === role
                                                    ? 'bg-primary/5 border-primary shadow-[0_0_0_1px_rgba(var(--primary),1)]'
                                                    : 'bg-background border-border hover:border-primary/50 hover:bg-secondary/50'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${inviteRole === role ? 'border-primary' : 'border-muted-foreground'}`}>
                                                {inviteRole === role && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm uppercase tracking-wide">{role}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {role === 'distributor' ? 'Full admin access' : role === 'dealer' ? 'Manager access' : 'Standard access'}
                                                </div>
                                            </div>
                                            {inviteRole === role && (
                                                <Check className="absolute right-3 w-4 h-4 text-primary" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-muted/30 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setIsInviteOpen(false)}
                                className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={inviting || !inviteEmail}
                                className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-bold shadow-sm hover:translate-y-[-1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                            >
                                {inviting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>Send Invitation <UserPlus className="w-3 h-3" /></>
                                )}
                            </button>
                        </div>

                        <Dialog.Close className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                            <X size={16} />
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
