"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Users, UserCog, UserMinus, Building2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetchTeamMembers, createTeam, updateTeamMember, removeTeamMember } from "@/app/actions/team-actions";

export default function TeamManagerClient({ initialTeams, tenantId, allUsers, initialRoles = [] }: { initialTeams: any[], tenantId: string, allUsers: any[], initialRoles?: any[] }) {
    const [teams, setTeams] = useState(initialTeams);
    const [roles, setRoles] = useState(initialRoles);
    const [selectedTeam, setSelectedTeam] = useState<any>(null);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    // Dialog state
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    // Create Team Form
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamParent, setNewTeamParent] = useState<string>("none");
    const [newTeamRegion, setNewTeamRegion] = useState("");
    const [newTeamCountry, setNewTeamCountry] = useState("");
    const [newTeamTimezone, setNewTeamTimezone] = useState("");
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);

    // Add User Form
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [selectedRole, setSelectedRole] = useState<'manager' | 'member'>('member');
    const [selectedSystemRole, setSelectedSystemRole] = useState<string>("none");
    const [isPrimary, setIsPrimary] = useState(true);
    const [isAddingUser, setIsAddingUser] = useState(false);

    useEffect(() => {
        if (selectedTeam) {
            loadMembers(selectedTeam.id);
        }
    }, [selectedTeam]);

    const loadMembers = async (teamId: string) => {
        setIsLoadingMembers(true);
        const res = await fetchTeamMembers(tenantId, teamId);
        if (res.success && res.data) {
            setTeamMembers(res.data);
        } else {
            toast.error(res.error || "Failed to load team members");
        }
        setIsLoadingMembers(false);
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        setIsCreatingTeam(true);

        const res = await createTeam({
            tenantId,
            name: newTeamName.trim(),
            parentTeamId: newTeamParent === "none" ? null : newTeamParent,
            region: newTeamRegion.trim() || null,
            country: newTeamCountry.trim() || null,
            timezone: newTeamTimezone.trim() || null
        });

        if (res.success && res.data) {
            toast.success("Team created!");
            setTeams([...teams, res.data]);
            setIsCreateTeamOpen(false);
            setNewTeamName("");
            setNewTeamParent("none");
            setNewTeamRegion("");
            setNewTeamCountry("");
            setNewTeamTimezone("");
        } else {
            toast.error(res.error || "Failed to create team");
        }
        setIsCreatingTeam(false);
    };

    const handleAddUser = async () => {
        if (!selectedUser || !selectedTeam) return;
        setIsAddingUser(true);

        const res = await updateTeamMember(
            tenantId,
            selectedTeam.id,
            selectedUser,
            selectedRole,
            isPrimary,
            selectedSystemRole === "none" ? undefined : selectedSystemRole
        );

        if (res.success) {
            toast.success("User added/updated successfully");
            await loadMembers(selectedTeam.id);
            setIsAddUserOpen(false);
            setSelectedUser("");
            setSelectedRole('member');
            setSelectedSystemRole("none");
            setIsPrimary(true);
        } else {
            toast.error(res.error || "Failed to update member");
        }
        setIsAddingUser(false);
    };

    const handleRemoveUser = async (userId: string) => {
        if (!selectedTeam) return;

        const res = await removeTeamMember(tenantId, selectedTeam.id, userId);
        if (res.success) {
            toast.success("Member removed");
            setTeamMembers(prev => prev.filter(m => m.user_id !== userId));
        } else {
            toast.error(res.error || "Failed to remove member");
        }
    };

    const availableUsersForAdd = allUsers.filter(u => !teamMembers.some(m => m.user_id === u.id) && u.status === 'active');

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-160px)]">

            {/* LEFT COLUMN: TEAM LIST */}
            <Card className="md:col-span-4 h-full flex flex-col border-white/10 bg-black/40 backdrop-blur shadow-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/10">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <Building2 className="w-5 h-5 text-brand-primary" />
                            Departments
                        </CardTitle>
                        <CardDescription className="text-xs">Manage your company structure</CardDescription>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={() => setIsCreateTeamOpen(true)}>
                        <Plus className="h-4 w-4 text-white" />
                    </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                    {teams.length === 0 ? (
                        <div className="p-8 text-center text-sm text-zinc-500">
                            No teams exist yet. Create one to organize users.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {teams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => setSelectedTeam(team)}
                                    className={`w-full flex items-center justify-between p-4 text-left transition-all border-b border-white/5 last:border-0 hover:bg-white/5 ${selectedTeam?.id === team.id ? 'bg-brand-primary/10 border-l-2 border-l-brand-primary' : 'border-l-2 border-l-transparent'}`}
                                >
                                    <div>
                                        <p className="font-semibold text-sm text-zinc-100">{team.name}</p>
                                        {team.parent?.name && (
                                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                                Under: {team.parent.name}
                                            </p>
                                        )}
                                        {team.region && (
                                            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                                                {team.region} {team.country && `• ${team.country}`}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedTeam?.id === team.id ? 'text-brand-primary translate-x-1' : 'text-zinc-600'}`} />
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* RIGHT COLUMN: TEAM DETAILS */}
            <div className="md:col-span-8 flex flex-col h-full bg-black/20 rounded-xl border border-white/5 shadow-inner overflow-hidden">
                {!selectedTeam ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                            <Users className="w-8 h-8 text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-medium text-zinc-300 mb-2">Select a Team</h3>
                        <p className="text-zinc-500 text-sm max-w-sm">Choose a team from the sidebar to view its roster, assign managers, and manage permissions.</p>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-white mb-1">{selectedTeam.name}</h2>
                                <p className="text-sm text-zinc-400">Manage individuals and their roles within this unit.</p>
                            </div>
                            <Button className="bg-brand-primary hover:bg-brand-primary/90 text-black shadow-brand" onClick={() => setIsAddUserOpen(true)}>
                                <UserCog className="w-4 h-4 mr-2" />
                                Add Member
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {isLoadingMembers ? (
                                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>
                            ) : teamMembers.length === 0 ? (
                                <div className="text-center p-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-zinc-300 mb-2">No members yet</h3>
                                    <p className="text-zinc-500 text-sm">Add users to this team to start managing assignments.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {teamMembers.map(member => (
                                        <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-brand-primary/20 flex items-center justify-center text-white font-medium shadow-inner">
                                                    {(member.user_profile?.display_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-zinc-100 flex items-center gap-2">
                                                        {member.user_profile?.display_name || member.user_profile?.email || 'Unknown User'}
                                                        {member.role_in_team === 'manager' && (
                                                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-[10px] uppercase border-amber-500/20 px-1 py-0 h-4">
                                                                Manager
                                                            </Badge>
                                                        )}
                                                        {member.user_profile?.role?.name && (
                                                            <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 px-1 py-0 h-4">
                                                                {member.user_profile.role.name}
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                                        {member.is_primary_team ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> : null}
                                                        {member.is_primary_team ? 'Primary Team' : 'Secondary Team'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleRemoveUser(member.user_id)}
                                                title="Remove from team"
                                            >
                                                <UserMinus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CREATE TEAM DIALOG */}
            <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Create New Team</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Create a structural division for your organization.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="text-zinc-300">Team Name</Label>
                            <Input
                                id="name"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                className="bg-black border-white/10"
                                placeholder="e.g., Sales Israel"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="parent" className="text-zinc-300">Parent Team (Optional)</Label>
                            <Select value={newTeamParent} onValueChange={setNewTeamParent}>
                                <SelectTrigger className="bg-black border-white/10">
                                    <SelectValue placeholder="Select parent" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                    <SelectItem value="none">No Parent (Top Level)</SelectItem>
                                    {teams.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="region" className="text-zinc-300">Region</Label>
                                <Input id="region" value={newTeamRegion} onChange={(e) => setNewTeamRegion(e.target.value)} className="bg-black border-white/10" placeholder="e.g., EMEA" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="country" className="text-zinc-300">Country</Label>
                                <Input id="country" value={newTeamCountry} onChange={(e) => setNewTeamCountry(e.target.value)} className="bg-black border-white/10" placeholder="e.g., Israel" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)} className="border-white/10 bg-white/5 hover:bg-white/10 text-white">Cancel</Button>
                        <Button onClick={handleCreateTeam} disabled={isCreatingTeam || !newTeamName.trim()} className="bg-brand-primary text-black hover:bg-brand-primary/90">
                            {isCreatingTeam && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Team
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ADD USER DIALOG */}
            {selectedTeam && (
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Add to {selectedTeam.name}</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Assign an existing user to this team and define their role.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="user" className="text-zinc-300">User</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="bg-black border-white/10">
                                        <SelectValue placeholder="Select user" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-60">
                                        {availableUsersForAdd.length === 0 ? (
                                            <div className="p-2 text-sm text-zinc-500 text-center">No available users found.</div>
                                        ) : (
                                            availableUsersForAdd.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.raw_user_meta_data?.full_name || u.email}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="role" className="text-zinc-300">Team Role</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setSelectedRole('member')}
                                        className={`flex flex-col items-center justify-center p-3 text-sm rounded-xl border transition-all ${selectedRole === 'member' ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}
                                    >
                                        <Users className="w-5 h-5 mb-1" />
                                        Team Member
                                    </button>
                                    <button
                                        onClick={() => setSelectedRole('manager')}
                                        className={`flex flex-col items-center justify-center p-3 text-sm rounded-xl border transition-all ${selectedRole === 'manager' ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}
                                    >
                                        <UserCog className="w-5 h-5 mb-1" />
                                        Team Manager
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="sysRole" className="text-zinc-300">CRM System Role (Permissions)</Label>
                                <Select value={selectedSystemRole} onValueChange={setSelectedSystemRole}>
                                    <SelectTrigger className="bg-black border-white/10">
                                        <SelectValue placeholder="Select an access role..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                        <SelectItem value="none">Don't Change Current Role</SelectItem>
                                        {roles.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="space-y-0.5">
                                    <Label className="text-zinc-200">Primary Team</Label>
                                    <p className="text-xs text-zinc-500">Is this their main unit?</p>
                                </div>
                                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} className="border-white/10 bg-white/5 hover:bg-white/10 text-white">Cancel</Button>
                            <Button onClick={handleAddUser} disabled={isAddingUser || !selectedUser} className="bg-brand-primary text-black hover:bg-brand-primary/90">
                                {isAddingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Assign User
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
