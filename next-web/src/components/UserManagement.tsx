"use client";

import { useEffect, useState } from "react";
import { fetchUsers } from "@/app/actions/fetchUsers";
import { inviteUser } from "@/app/actions/inviteUser";
import { toggleUserStatus } from "@/app/actions/toggleUserStatus";
import { Loader2, Plus, User, Shield, Mail, Trash2, CheckCircle, XCircle, Power, Ban } from "lucide-react";

type UserProfile = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status?: string; // Added via migration 118
    created_at: string;
};

export default function UserManagement({ tenantId }: { tenantId?: string }) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        firstName: "",
        lastName: "",
        role: "agent",
        password: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Toggle State
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        if (tenantId) loadUsers(tenantId);
        else setLoading(false);
    }, [tenantId]);

    const loadUsers = async (tid: string) => {
        setLoading(true);
        try {
            const res = await fetchUsers(tid);
            if (res.users) setUsers(res.users as any);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;
        setSubmitting(true);
        setMessage(null);

        const form = new FormData();
        form.append('email', formData.email);
        form.append('firstName', formData.firstName);
        form.append('lastName', formData.lastName);
        form.append('role', formData.role);
        form.append('tenantId', tenantId);
        if (formData.password) form.append('password', formData.password);

        const res = await inviteUser(form);
        setSubmitting(false);

        if (res.error) {
            setMessage({ type: 'error', text: res.error });
        } else {
            setMessage({ type: 'success', text: "User created successfully!" });
            setFormData({ email: "", firstName: "", lastName: "", role: "agent", password: "" });
            setIsInviteOpen(false);
            loadUsers(tenantId);
        }
    };

    const handleToggleStatus = async (user: UserProfile) => {
        if (!tenantId) return;
        setTogglingId(user.id);

        await toggleUserStatus(user.id, user.status || 'active', tenantId);

        // Optimistic update or reload
        await loadUsers(tenantId);
        setTogglingId(null);
    }

    if (!tenantId) return <div className="p-10 text-center text-muted-foreground bg-card rounded-xl border border-dashed border-border">Please select a tenant first.</div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Team Members</h2>
                    <p className="text-sm text-muted-foreground">Manage access, roles, and account status.</p>
                </div>
                <button
                    onClick={() => setIsInviteOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} />
                    Add Member
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid gap-3">
                    {users.map(user => {
                        const isSuspended = user.status === 'suspended';
                        return (
                            <div key={user.id} className={`p-4 rounded-xl border transition-all flex items-center justify-between group 
                            ${isSuspended ? 'bg-secondary/30 border-border opacity-70' : 'bg-card border-border shadow-sm hover:shadow-md'}
                        `}>
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-sm select-none
                                     ${isSuspended
                                            ? 'bg-muted text-muted-foreground border-border'
                                            : 'bg-primary/10 text-primary border-primary/20'}
                                 `}>
                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                    </div>

                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold text-sm ${isSuspended ? 'text-muted-foreground line-through' : 'text-card-foreground'}`}>
                                                {user.first_name} {user.last_name}
                                            </span>
                                            {isSuspended && <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded border border-destructive/20 uppercase">Suspended</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Mail size={12} /> {user.email}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Role Badge */}
                                    <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border uppercase tracking-wider
                                     ${user.role === 'distributor' ? 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-500/20' :
                                            user.role === 'dealer' ? 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-500/20' :
                                                'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}
                                 `}>
                                        {user.role}
                                    </span>

                                    <div className="h-4 w-px bg-border mx-1"></div>

                                    {/* Action Buttons */}
                                    <button
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={togglingId === user.id}
                                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border
                                        ${isSuspended
                                                ? 'bg-green-500/5 text-green-600 border-green-200 hover:bg-green-500/10 hover:border-green-300 dark:border-green-500/20'
                                                : 'bg-secondary text-muted-foreground border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30'}
                                    `}
                                        title={isSuspended ? "Activate User" : "Suspend User"}
                                    >
                                        {togglingId === user.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : isSuspended ? (
                                            <><CheckCircle size={14} /> Unfreeze</>
                                        ) : (
                                            <><Ban size={14} /> Freeze</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {users.length === 0 && (
                        <div className="text-center p-12 bg-muted/30 border border-dashed border-border rounded-xl">
                            <User className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                            <h3 className="text-foreground font-medium">No team members yet</h3>
                            <p className="text-xs text-muted-foreground mt-1">Invite your first agent or manager to get started.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Invite Modal */}
            {isInviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsInviteOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <XCircle size={20} />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-card-foreground">Add New Member</h3>
                            <p className="text-sm text-muted-foreground">Send an invitation to join this workspace.</p>
                        </div>

                        <form onSubmit={handleInvite} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">First Name</label>
                                    <input
                                        required
                                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                                    <input
                                        required
                                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="colleague@company.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">System Role</label>
                                <select
                                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="distributor">Distributor (Admin)</option>
                                    <option value="dealer">Dealer (Manager)</option>
                                    <option value="agent">Agent (Restricted)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-border mt-2">
                                <label className="text-xs font-medium text-muted-foreground flex justify-between">
                                    <span>Set Password (Optional)</span>
                                    <span className="text-[10px] bg-secondary px-1.5 rounded text-muted-foreground">Auto-Confirm</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Leave empty to send email invite"
                                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 font-medium ${message.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
                                    {message.type === 'error' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                                    {message.text}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : "Send Invitation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
