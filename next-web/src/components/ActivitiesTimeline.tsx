"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fetchActivities, createActivity } from "@/app/actions/activity-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Mail, FileText, CheckSquare, Calendar, MessageSquare, Plus, User } from "lucide-react";
import { fetchTenantDetails } from "@/app/actions/fetchTenantDetails";

interface Activity {
    id: string;
    activity_type: string;
    subject: string | null;
    body: string | null;
    due_at: string | null;
    completed_at: string | null;
    priority: string;
    created_at: string;
    assigned_to?: string;
    created_by?: string;
}

interface ActivitiesTimelineProps {
    tenantId: string;
    entityId: string;
    entityType: "card" | "opportunity" | "lead";
}

export function ActivitiesTimeline({ tenantId, entityId, entityType }: ActivitiesTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [activityType, setActivityType] = useState<string>("note");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [assignedTo, setAssignedTo] = useState<string>("me");
    const [isPrivate, setIsPrivate] = useState<boolean>(false);
    const [users, setUsers] = useState<any[]>([]);

    const loadActivities = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Load users for the assignment dropdown
            if (users.length === 0) {
                const detailsRes = await fetchTenantDetails(tenantId);
                if (detailsRes.success && detailsRes.data?.users) {
                    setUsers(detailsRes.data.users);
                }
            }

            const res = await fetchActivities(tenantId, entityId, entityType);
            if (res.success && res.data) {
                setActivities(res.data as Activity[]);
            } else {
                setError(res.error || "Failed to load activities");
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadActivities();
    }, [tenantId, entityId, entityType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim() && !subject.trim()) return;

        setIsSubmitting(true);
        try {
            const payload = {
                tenantId,
                entityId,
                entityType,
                activityType: activityType as any,
                title: subject.trim(),
                description: body.trim(),
                isTask: activityType === "task",
                priority: "normal" as const,
                participants: assignedTo === "me" ? [] : [{
                    id: assignedTo,
                    type: "user" as const,
                    role: "assignee" as const
                }]
            };

            const res = await createActivity(payload);

            if (res.success) {
                // Reset form
                setSubject("");
                setBody("");
                setAssignedTo("me");
                setIsPrivate(false);
                // Reload
                await loadActivities();
            } else {
                setError(res.error || "Failed to create activity");
            }
        } catch (e) {
            setError("An unexpected error occurred while saving");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case "call": return <Phone className="h-4 w-4 text-blue-500" />;
            case "email": return <Mail className="h-4 w-4 text-purple-500" />;
            case "meeting": return <Calendar className="h-4 w-4 text-green-500" />;
            case "task": return <CheckSquare className="h-4 w-4 text-orange-500" />;
            case "sms":
            case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-600" />;
            default: return <FileText className="h-4 w-4 text-gray-500" />;
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const d = new Date(dateString);
            return new Intl.DateTimeFormat("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "numeric"
            }).format(d);
        } catch {
            return dateString;
        }
    };

    return (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Activities
                </h3>
            </div>

            <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3 text-foreground">Add Activity</h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-2">
                        <Select value={activityType} onValueChange={setActivityType}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="note">Note</SelectItem>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="meeting">Meeting</SelectItem>
                                <SelectItem value="task">Task</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Subject (optional)"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                    <Textarea
                        placeholder="Write details here..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="min-h-[80px]"
                    />

                    {/* Extra options row: Assignee & Privacy */}
                    <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-y border-border/50">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <Select value={assignedTo} onValueChange={setAssignedTo}>
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Assign To..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="me">Assign to Me</SelectItem>
                                    {users.filter(u => u.status === 'active').map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.raw_user_meta_data?.full_name || u.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch id="privacy-mode" checked={isPrivate} onCheckedChange={setIsPrivate} />
                            <Label htmlFor="privacy-mode" className="text-xs cursor-pointer select-none text-muted-foreground">
                                Private Activity
                            </Label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                        {error ? <span className="text-sm text-red-500">{error}</span> : <span />}
                        <Button type="submit" disabled={isSubmitting || (!body.trim() && !subject.trim())}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Save Activity
                        </Button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Timeline</h3>

                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : activities.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border rounded-xl border-dashed bg-muted/20">
                        No activities yet. Start by adding a note above.
                    </div>
                ) : (
                    <div className="relative border-l border-border/50 ml-3 space-y-6">
                        {activities.map((activity) => (
                            <div key={activity.id} className="relative pl-6">
                                <span className="absolute -left-[11px] top-1 bg-background border border-border rounded-full p-1 shadow-sm">
                                    {getIconForType(activity.activity_type)}
                                </span>
                                <div className="bg-background border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-sm text-foreground capitalize">
                                            {activity.activity_type === "note" ? "Logged Note" : `Logged ${activity.activity_type}`}
                                        </span>
                                        <span className="text-xs text-muted-foreground" title={activity.created_at}>
                                            {formatDate(activity.created_at)}
                                        </span>
                                    </div>
                                    {activity.assigned_to && (
                                        <div className="flex items-center gap-1 mb-2 text-xs text-indigo-600 font-medium">
                                            <User className="h-3 w-3" />
                                            <span>
                                                Assigned to {
                                                    users.find(u => u.id === activity.assigned_to)?.raw_user_meta_data?.full_name
                                                    || "someone else"
                                                }
                                            </span>
                                        </div>
                                    )}
                                    {activity.subject && (
                                        <h4 className="text-sm font-semibold text-foreground mb-1">{activity.subject}</h4>
                                    )}
                                    {activity.body && (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.body}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
