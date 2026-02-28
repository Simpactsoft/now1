"use client";

import { useState, useEffect } from "react";
import { fetchUsers, UserProfile } from "@/app/actions/fetchUsers";
import { inviteUser } from "@/app/actions/inviteUser";
import { toast } from "sonner";
import { Mail, Shield, MoreHorizontal, UserPlus, Building2, Key, Check, X, Trash2, LayoutGrid, List, Tags, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { updateTeamMemberPassword } from "@/app/actions/updateTeamMemberPassword";
import { deleteTeamMember, updateUserStatus } from "@/app/actions/team-actions";
import { ColumnDef } from "@/components/entity-view/types";
import { useLanguage } from "@/context/LanguageContext";
import { EntityAgGrid } from "@/components/entity-view/EntityAgGrid";
import UserTags from "./UserTags";

export default function UserManagement({ tenantId }: { tenantId?: string }) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    // Invite State
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<'distributor' | 'dealer' | 'agent'>('agent');
    const [inviting, setInviting] = useState(false);

    // Set Password State
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [selectedUserForPassword, setSelectedUserForPassword] = useState<{ id: string, name: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

    // View Mode
    const [viewMode, setViewMode] = useState<'cards' | 'grid' | 'tags'>('tags');

    // Action State (Delete/Suspend)
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { t, language } = useLanguage();

    useEffect(() => {
        if (tenantId) loadUsers();
    }, [tenantId]);

    const loadUsers = async () => {
        setLoading(true);
        const res = await fetchUsers(tenantId!);
        if (res.success) {
            setUsers(res.data?.users || []);
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
    const groupedUsers = (users || []).reduce((acc, user) => {
        // user.tenants is an object { name: ... } from the join
        const tName = user.tenants?.name || "Unknown Organization";
        if (!acc[tName]) acc[tName] = [];
        acc[tName].push(user);
        return acc;
    }, {} as Record<string, UserProfile[]>);

    const handleSetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserForPassword) return;

        setPasswordLoading(true);
        try {
            const res = await updateTeamMemberPassword(selectedUserForPassword.id, newPassword);
            if (res.success) {
                toast.success(`Password updated for ${selectedUserForPassword.name}`);
                setPasswordModalOpen(false);
                setNewPassword("");
            } else {
                toast.error(res.error || "Failed to update password");
            }
        } catch (e: any) {
            toast.error(e.message || "An error occurred");
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

        setActionLoading(userId);
        try {
            const res = await deleteTeamMember(userId);
            if (res.success) {
                toast.success(`User ${name} deleted successfully`);
                loadUsers();
            } else {
                toast.error(res.error || "Failed to delete user");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string, name: string) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        const actionLabel = newStatus === 'suspended' ? 'suspend' : 'activate';

        if (!confirm(`Are you sure you want to ${actionLabel} ${name}?`)) return;

        setActionLoading(userId);
        try {
            const res = await updateUserStatus(userId, newStatus);
            if (res.success) {
                toast.success(`User ${name} is now ${newStatus}`);
                loadUsers();
            } else {
                toast.error(res.error || `Failed to ${actionLabel} user`);
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setActionLoading(null);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} users? This cannot be undone.`)) return;

        setActionLoading('bulk');
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
            const res = await deleteTeamMember(id);
            if (res.success) successCount++;
            else failCount++;
        }

        if (successCount > 0) toast.success(`${t('serverReceived')}: ${successCount}`);
        if (failCount > 0) toast.error(`Failed to delete ${failCount} users`);

        setSelectedIds([]);
        loadUsers();
        setActionLoading(null);
    };

    const handleBulkSuspend = async (suspend: boolean) => {
        const status = suspend ? 'suspended' : 'active';
        if (!confirm(`Are you sure you want to ${suspend ? 'suspend' : 'activate'} ${selectedIds.length} users?`)) return;

        setActionLoading('bulk');
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
            const res = await updateUserStatus(id, status);
            if (res.success) successCount++;
            else failCount++;
        }

        if (successCount > 0) toast.success(`${t('serverReceived')}: ${successCount}`);
        if (failCount > 0) toast.error(`Failed to update ${failCount} users`);

        setSelectedIds([]);
        loadUsers();
        setActionLoading(null);
    };

    const gridColumns: ColumnDef<UserProfile>[] = [
        {
            field: "selection",
            headerName: "",
            width: 40,
            checkboxSelection: true,
            headerCheckboxSelection: true,
            pinned: 'left'
        },
        {
            field: "full_name",
            headerName: t('fullName'),
            flex: 2,
            valueGetter: (data) => `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email,
            cellRenderer: ({ data }) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                        {(data.first_name?.[0] || data.email[0]).toUpperCase()}
                    </div>
                    <span className="truncate">{`${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email}</span>
                </div>
            )
        },
        {
            field: "email",
            headerName: "Email",
            flex: 2,
            cellRenderer: ({ value }) => (
                <div className="flex items-center text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 mr-2" />
                    <span className="truncate">{value}</span>
                </div>
            )
        },
        {
            field: "role",
            headerName: t('accessRole'),
            flex: 1,
            cellRenderer: ({ value }) => (
                <span className="capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold">
                    {value}
                </span>
            )
        },
        {
            field: "status",
            headerName: t('status'),
            flex: 1,
            cellRenderer: ({ value }) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${value === 'active'
                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                    : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                    }`}>
                    {value}
                </span>
            )
        },
        {
            field: "actions",
            headerName: t('methods'),
            width: 120,
            cellRenderer: ({ data }) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSelectedUserForPassword({ id: data.id, name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email });
                            setNewPassword("");
                            setPasswordModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-secondary rounded text-muted-foreground transition-colors"
                        title={t('setPassword')}
                    >
                        <Key size={14} />
                    </button>
                    <button
                        onClick={() => handleToggleStatus(data.id, data.status, data.first_name || data.email)}
                        className={`p-1.5 hover:bg-secondary rounded transition-colors ${data.status === 'suspended' ? 'text-green-500' : 'text-yellow-600'}`}
                        title={data.status === 'suspended' ? t('activateUser') : t('suspendUser')}
                    >
                        {data.status === 'suspended' ? <Check size={14} /> : <X size={14} />}
                    </button>
                    <button
                        onClick={() => handleDeleteUser(data.id, data.first_name || data.email)}
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
                        title={t('deleteUser')}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    if (pageError) {
        return <div className="p-8 text-center text-destructive">{pageError}</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold">{t('teamMembers')}</h2>
                    <p className="text-sm text-muted-foreground">{t('manageUsers')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setViewMode('tags')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'tags' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('tagsView')}
                        >
                            <Tags className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('gridView')}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('cardView')}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
                    >
                        <UserPlus size={16} />
                        {t('inviteMember')}
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">
                            {selectedIds.length}
                        </div>
                        <span className="text-sm font-medium">{t('usersSelected')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkSuspend(true)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors border border-yellow-200"
                        >
                            <X size={14} />
                            {t('suspendSelected')}
                        </button>
                        <button
                            onClick={() => handleBulkSuspend(false)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200"
                        >
                            <Check size={14} />
                            {t('activateSelected')}
                        </button>
                        <div className="w-px h-4 bg-border mx-2" />
                        <button
                            onClick={handleBulkDelete}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-destructive/20"
                        >
                            <Trash2 size={14} />
                            {t('deleteSelected')}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p>{t('loadingTeam')}</p>
                </div>
            ) : Object.keys(groupedUsers).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-muted rounded-xl bg-muted/10">
                    <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{t('noTeamFound')}</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        {t('getStartedInvite')}
                    </p>
                </div>
            ) : viewMode === 'tags' ? (
                <UserTags
                    users={users}
                    loading={loading}
                    onSetPassword={setSelectedUserForPassword}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDeleteUser}
                />
            ) : viewMode === 'grid' ? (
                <div className="h-[calc(100vh-280px)] w-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <EntityAgGrid
                        data={users}
                        columns={gridColumns}
                        loading={loading}
                        selectedIds={selectedIds}
                        sorting={[]}
                        pagination={{ page: 1, pageSize: users.length, totalRecords: users.length, totalPages: 1 }}
                        onSelectionChange={(ids) => setSelectedIds(ids)}
                        onSortChange={() => { }}
                        onPaginationChange={() => { }}
                        showPagination={false}
                        rowSelection="multiple"
                    />
                </div>
            ) : (
                <div className="grid gap-8">
                    {(Object.entries(groupedUsers) as [string, UserProfile[]][]).map(([tenantName, tenantUsers]) => (
                        <div key={tenantName} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-none">{tenantName}</h3>
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {tenantUsers.length} {t('members')}
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {tenantUsers.map((user) => (
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

                                        <DropdownMenu.Root>
                                            <DropdownMenu.Trigger asChild>
                                                <button className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity outline-none">
                                                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                            </DropdownMenu.Trigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.Content align="end" className="w-48 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                                                    <DropdownMenu.Item
                                                        onSelect={() => {
                                                            setSelectedUserForPassword({ id: user.id, name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email });
                                                            setNewPassword("");
                                                            setPasswordModalOpen(true);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary hover:text-foreground cursor-default outline-none select-none transition-colors"
                                                    >
                                                        <Key size={14} className="text-muted-foreground" />
                                                        {t('setPassword')}
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item
                                                        onSelect={() => handleToggleStatus(user.id, user.status, user.first_name || user.email)}
                                                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-default outline-none select-none transition-colors ${user.status === 'suspended' ? 'text-green-600 hover:bg-green-50' : 'text-yellow-600 hover:bg-yellow-50'}`}
                                                    >
                                                        {user.status === 'suspended' ? <Check size={14} /> : <X size={14} />}
                                                        {user.status === 'suspended' ? t('activateUser') : t('suspendUser')}
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                                                    <DropdownMenu.Item
                                                        onSelect={() => handleDeleteUser(user.id, user.first_name || user.email)}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 cursor-default outline-none select-none transition-colors font-medium"
                                                    >
                                                        <Trash2 size={14} />
                                                        {t('deleteUser')}
                                                    </DropdownMenu.Item>
                                                </DropdownMenu.Content>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Root>
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
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background p-0 rounded-2xl shadow-2xl z-50 border border-border animate-in zoom-in-95 duration-200 overflow-hidden text-start" dir={language === 'he' ? 'rtl' : 'ltr'}>
                        <div className="p-6 border-b border-border bg-muted/30">
                            <Dialog.Title className="text-xl font-bold">{t('inviteDialogTitle')}</Dialog.Title>
                            <Dialog.Description className="text-sm text-muted-foreground mt-1">
                                {t('inviteDialogDesc')} <span className="font-medium text-foreground">{Object.keys(groupedUsers)[0] || 'your organization'}</span>.
                            </Dialog.Description>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t('emailAddress')}</label>
                                <div className="relative">
                                    <Mail className={`absolute ${language === 'he' ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-muted-foreground`} />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className={`w-full ${language === 'he' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all`}
                                        placeholder="colleague@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t('accessRole')}</label>
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
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${language === 'he' ? 'ml-3' : 'mr-3'} ${inviteRole === role ? 'border-primary' : 'border-muted-foreground'}`}>
                                                {inviteRole === role && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                            <div className={language === 'he' ? 'text-right' : 'text-left'}>
                                                <div className="font-bold text-sm uppercase tracking-wide">{role}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {role === 'distributor' ? t('distributorDesc') : role === 'dealer' ? t('dealerDesc') : t('agentDesc')}
                                                </div>
                                            </div>
                                            {inviteRole === role && (
                                                <Check className={`absolute ${language === 'he' ? 'left-3' : 'right-3'} w-4 h-4 text-primary`} />
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
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={inviting || !inviteEmail}
                                className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-bold shadow-sm hover:translate-y-[-1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                            >
                                {inviting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-white rounded-full animate-spin" />
                                        {t('sending')}
                                    </>
                                ) : (
                                    <>{t('sendInvitation')} <UserPlus className="w-3 h-3" /></>
                                )}
                            </button>
                        </div>

                        <Dialog.Close className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                            <X size={16} />
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Set Password Dialog */}
            <Dialog.Root open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-background p-0 rounded-2xl shadow-2xl z-50 border border-border animate-in zoom-in-95 duration-200 overflow-hidden text-start" dir={language === 'he' ? 'rtl' : 'ltr'}>
                        <div className="p-6 border-b border-border bg-muted/30 flex items-center gap-3">
                            <Key className="w-5 h-5 text-indigo-500" />
                            <Dialog.Title className="text-lg font-bold">{t('setPassword')}</Dialog.Title>
                        </div>

                        <form onSubmit={handleSetPasswordSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t('overridePasswordDesc')} <span className="font-semibold text-foreground">{selectedUserForPassword?.name}</span>.
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t('newPassword')}</label>
                                <input
                                    type="text"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder={t('passwordMinLength')}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPasswordModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={passwordLoading || newPassword.length < 6}
                                    className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm hover:translate-y-[-1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                                >
                                    {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    {t('savePassword')}
                                </button>
                            </div>
                        </form>

                        <Dialog.Close className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                            <X size={16} />
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
