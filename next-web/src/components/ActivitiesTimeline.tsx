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
import { GlobalActivityComposer } from "./activities/GlobalActivityComposer";
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
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
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

    const handleComposerSuccess = () => {
        loadActivities();
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

            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-foreground">Active Tracking</h3>
                    <p className="text-xs text-muted-foreground">Log a call, schedule a meeting, or assign a task.</p>
                </div>
                <Button onClick={() => setIsComposerOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Activity
                </Button>
            </div>

            <GlobalActivityComposer
                tenantId={tenantId}
                isOpen={isComposerOpen}
                onClose={() => setIsComposerOpen(false)}
                onSuccess={handleComposerSuccess}
                prefilledEntity={{ id: entityId, name: "Current Item", type: entityType }}
            />

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
