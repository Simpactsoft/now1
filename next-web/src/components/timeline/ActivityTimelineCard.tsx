import React from "react";
import { ActivityCreatedEvent, ActivityUpdatedEvent, ActivityDeletedEvent } from "./types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2Icon, Clock, CalendarDays, Edit2Icon, TrashIcon, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ActivityTimelineCard({
    event,
}: {
    event: ActivityCreatedEvent | ActivityUpdatedEvent | ActivityDeletedEvent;
}) {
    const isCreated = event.event_type === "activity_created";
    const isDeleted = event.event_type === "activity_deleted";
    const { payload, actor_metadata, occurred_at } = event;

    const actorName = actor_metadata?.name || actor_metadata?.email || "System";

    const getIcon = () => {
        switch (payload.type) {
            case "task":
                return <CheckCircle2Icon className="w-5 h-5" />;
            case "meeting":
                return <CalendarDays className="w-5 h-5" />;
            case "email":
                return <Mail className="w-5 h-5" />;
            default:
                return <CheckCircle2Icon className="w-5 h-5" />;
        }
    };

    return (
        <Card className={`p-4 ${isDeleted ? "opacity-60 grayscale" : ""}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                    <div
                        className={`mt-1 p-2 rounded-full ${isCreated
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                : isDeleted
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }`}
                    >
                        {isCreated ? getIcon() : isDeleted ? <TrashIcon className="w-5 h-5" /> : <Edit2Icon className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{actorName}</span>
                            <span className="text-muted-foreground text-sm">
                                {isCreated
                                    ? `logged a ${payload.type}`
                                    : isDeleted
                                        ? `deleted a ${payload.type}`
                                        : `updated a ${payload.type}`}
                            </span>
                        </div>
                        <div className="text-lg font-medium mt-1">
                            {payload.title}
                        </div>
                        <div className="mt-2 flex gap-2">
                            <Badge variant="outline" className="capitalize">{payload.type}</Badge>
                            {payload.priority && payload.priority !== 'normal' && (
                                <Badge variant="default" className="capitalize bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-100">{payload.priority}</Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(occurred_at), { addSuffix: true })}</span>
                </div>
            </div>
        </Card>
    );
}
