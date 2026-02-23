import React from "react";
import { QuoteCreatedEvent, QuoteUpdatedEvent, QuoteDeletedEvent } from "./types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReceiptIcon, Clock, Edit2Icon, TrashIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function QuoteTimelineCard({
    event,
}: {
    event: QuoteCreatedEvent | QuoteUpdatedEvent | QuoteDeletedEvent;
}) {
    const isCreated = event.event_type === "quote_created";
    const isDeleted = event.event_type === "quote_deleted";
    const { payload, actor_metadata, occurred_at } = event;

    const actorName = actor_metadata?.name || actor_metadata?.email || "System";

    return (
        <Card className={`p-4 ${isDeleted ? "opacity-60 grayscale" : ""}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                    <div
                        className={`mt-1 p-2 rounded-full ${isCreated
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : isDeleted
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }`}
                    >
                        {isCreated ? (
                            <ReceiptIcon className="w-5 h-5" />
                        ) : isDeleted ? (
                            <TrashIcon className="w-5 h-5" />
                        ) : (
                            <Edit2Icon className="w-5 h-5" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{actorName}</span>
                            <span className="text-muted-foreground text-sm">
                                {isCreated
                                    ? "created a quote"
                                    : isDeleted
                                        ? "deleted a quote"
                                        : "updated a quote"}
                            </span>
                        </div>
                        <div className="text-xl font-medium mt-1">
                            {payload.quote_number} —{" "}
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: payload.currency || 'USD' }).format(payload.amount)}
                        </div>
                        <div className="mt-2">
                            <Badge variant="outline">{payload.status}</Badge>
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
