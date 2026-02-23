"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, Plus, Calendar, Clock, User, Mail, Link as LinkIcon, AlertCircle, X, CheckSquare, Phone, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchTenantDetails } from "@/app/actions/fetchTenantDetails";
import { createActivity } from "@/app/actions/activity-actions";
// We need a global search helper

// Basic type for our search results later
type EntityOption = { id: string, name: string, type: 'card' | 'opportunity' | 'lead' };

interface ComposerProps {
    tenantId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    // Context
    prefilledEntity?: { id: string, name: string, type: 'card' | 'opportunity' | 'lead' };
    defaultType?: "note" | "call" | "email" | "meeting" | "task";
}

export function GlobalActivityComposer({
    tenantId,
    isOpen,
    onClose,
    onSuccess,
    prefilledEntity,
    defaultType = "task"
}: ComposerProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingContext, setIsLoadingContext] = useState(false);

    // Form fields
    const [activityType, setActivityType] = useState<string>(defaultType);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [dueDate, setDueDate] = useState<string>("");

    // Entity Context
    const [linkedEntity, setLinkedEntity] = useState<EntityOption | null>(prefilledEntity || null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<EntityOption[]>([]);

    // Participants grid
    const [assigneeId, setAssigneeId] = useState<string>("me");
    const [ccUsers, setCcUsers] = useState<string[]>([]);

    // Privacy
    const [isPrivate, setIsPrivate] = useState(false);

    useEffect(() => {
        if (isOpen && users.length === 0) {
            loadUsers();
        }
        // Reset when opening
        if (isOpen) {
            setActivityType(defaultType);
            setLinkedEntity(prefilledEntity || null);
            setSubject("");
            setBody("");
            setDueDate("");
            setAssigneeId("me");
            setCcUsers([]);
        }
    }, [isOpen]);

    const loadUsers = async () => {
        setIsLoadingContext(true);
        const res = await fetchTenantDetails(tenantId);
        if (res.success && res.data?.users) {
            setUsers(res.data.users);
        }
        setIsLoadingContext(false);
    };

    const handleSearchEntity = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        // Simplistic search dummy for now, will implement robust global search action
        // For MVP frontend binding:
        setSearchResults([
            { id: "some-id", name: "Search: " + query, type: "card" }
        ]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim() && !subject.trim()) {
            toast.error("Please provide a subject or description");
            return;
        }

        setIsSubmitting(true);
        try {
            // Build participants array properly
            const participants = [];
            if (assigneeId !== "me") {
                participants.push({ id: assigneeId, type: "user" as const, role: "assignee" as const });
            }
            ccUsers.forEach(cc => {
                participants.push({ id: cc, type: "user" as const, role: "email_cc" as const });
            });

            const payload = {
                tenantId,
                entityId: linkedEntity?.id || undefined,
                entityType: linkedEntity?.type || undefined,
                activityType: activityType as any,
                title: subject.trim(),
                description: body.trim(),
                isTask: activityType === "task",
                dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
                priority: "normal" as const,
                participants
            };

            const res = await createActivity(payload);

            if (res.success) {
                toast.success(`${activityType} created successfully`);
                onSuccess();
                onClose();
            } else {
                toast.error(res.error || "Failed to create activity");
            }
        } catch (e) {
            toast.error("An unexpected error occurred while saving");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden">
                <div className="flex flex-col h-full max-h-[85vh]">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {activityType === 'task' && <CheckSquare className="w-5 h-5 text-orange-500" />}
                            {activityType === 'meeting' && <Calendar className="w-5 h-5 text-green-500" />}
                            {activityType === 'email' && <Mail className="w-5 h-5 text-purple-500" />}
                            {activityType === 'call' && <Phone className="w-5 h-5 text-blue-500" />}
                            {activityType === 'note' && <FileText className="w-5 h-5 text-gray-500" />}
                            New {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Log an interaction or plan a future step.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {/* Top row: Type & Context */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Activity Type</Label>
                                <Select value={activityType} onValueChange={setActivityType}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="note">Note / Log</SelectItem>
                                        <SelectItem value="task">Task / To-Do</SelectItem>
                                        <SelectItem value="meeting">Meeting</SelectItem>
                                        <SelectItem value="call">Call</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 relative">
                                <Label className="flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> Related To
                                </Label>
                                {linkedEntity ? (
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-brand-primary/10 border border-brand-primary/20 h-10">
                                        <span className="text-sm font-medium text-brand-primary truncate">{linkedEntity.name}</span>
                                        {!prefilledEntity && (
                                            <button onClick={() => setLinkedEntity(null)} className="text-brand-primary/60 hover:text-brand-primary">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Input
                                            placeholder="Search contact or company..."
                                            value={searchQuery}
                                            onChange={(e) => handleSearchEntity(e.target.value)}
                                            onFocus={() => setIsSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                                            className="h-10"
                                        />
                                        {isSearchOpen && searchResults.length > 0 && (
                                            <div className="absolute top-11 left-0 right-0 max-h-48 overflow-y-auto bg-background border rounded-lg shadow-xl z-50">
                                                {searchResults.map(res => (
                                                    <button
                                                        key={res.id}
                                                        className="w-full text-left p-3 text-sm hover:bg-muted transition-colors border-b last:border-0"
                                                        onClick={() => {
                                                            setLinkedEntity(res);
                                                            setIsSearchOpen(false);
                                                        }}
                                                    >
                                                        {res.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Middle: Content */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Subject / Title</Label>
                                <Input
                                    placeholder="Brief description..."
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Details</Label>
                                <Textarea
                                    placeholder="Write full details here..."
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="min-h-[120px]"
                                />
                            </div>
                        </div>

                        {/* Bottom: Settings & Participants */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                            {/* Dates */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</h4>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs">Due Date & Time</Label>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="datetime-local"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="text-sm h-9"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Participants */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Participants</h4>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Assign To (Owner)</Label>
                                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Assign To..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="me">Assigned to Me</SelectItem>
                                                {users.filter(u => u.status === 'active').map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.raw_user_meta_data?.full_name || u.email}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Minimal Multi-select for CCs (can be expanded later) */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs flex items-center justify-between">
                                            <span>CC / Watchers</span>
                                        </Label>
                                        <Select
                                            value=""
                                            onValueChange={(val) => {
                                                if (val && !ccUsers.includes(val)) setCcUsers([...ccUsers, val]);
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Add someone..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users.filter(u => u.status === 'active' && u.id !== assigneeId && !ccUsers.includes(u.id)).map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.raw_user_meta_data?.full_name || u.email}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Display selected CCs */}
                                        {ccUsers.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {ccUsers.map(cc => {
                                                    const user = users.find(u => u.id === cc);
                                                    return (
                                                        <div key={cc} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs">
                                                            <span>{user?.raw_user_meta_data?.full_name || user?.email}</span>
                                                            <button onClick={() => setCcUsers(ccUsers.filter(u => u !== cc))} className="hover:text-red-400">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <Switch id="private-toggle" checked={isPrivate} onCheckedChange={setIsPrivate} />
                                <Label htmlFor="private-toggle" className="text-xs text-muted-foreground cursor-pointer">Private Activity</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || (!body.trim() && !subject.trim())}
                                    className="bg-brand-primary text-primary-foreground hover:bg-brand-primary/90 min-w-[120px]"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
