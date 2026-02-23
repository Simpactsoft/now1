"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActivityStream } from "@/hooks/useActivityStream";
import { ActivityStreamEvent } from "./types";
import { QuoteTimelineCard } from "./QuoteTimelineCard";
import { ActivityTimelineCard } from "./ActivityTimelineCard";
import { Loader2, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalActivityComposer } from "../activities/GlobalActivityComposer";

// The Component Registry
const getTimelineComponent = (event: ActivityStreamEvent) => {
    switch (event.event_type) {
        case "quote_created":
        case "quote_updated":
        case "quote_deleted":
            return <QuoteTimelineCard key={event.id} event={event as any} />;
        case "activity_created":
        case "activity_updated":
        case "activity_deleted":
            return <ActivityTimelineCard key={event.id} event={event as any} />;
        default:
            // Fallback for unknown event types
            return (
                <div key={(event as any).id} className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    Unknown event type: {(event as any).event_type}
                </div>
            );
    }
};

export function TimelineFeed({ entityId }: { entityId: string }) {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        error,
    } = useActivityStream(entityId, 20);

    const queryClient = useQueryClient();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const [isComposerOpen, setIsComposerOpen] = useState(false);

    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage) return;

        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                fetchNextPage();
            }
        });

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (status === "pending") {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg dark:bg-red-950 dark:text-red-400">
                Error loading timeline: {(error as Error).message}
            </div>
        );
    }

    const events = data.pages.flatMap((page: any) => page.events) as ActivityStreamEvent[];

    if (events.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsComposerOpen(true)}>
                        <PlusIcon className="w-4 h-4" />
                        הוסף פעילות
                    </Button>
                    <GlobalActivityComposer
                        isOpen={isComposerOpen}
                        onClose={() => setIsComposerOpen(false)}
                        tenantId=""
                        prefilledEntity={{ id: entityId, type: "card", name: "Current Customer" }}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["timeline", entityId] })}
                    />
                </div>
                <div className="text-center p-8 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                    לא נמצאה היסטוריית פעילויות.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsComposerOpen(true)}>
                    <PlusIcon className="w-4 h-4" />
                    הוסף פעילות
                </Button>
                <GlobalActivityComposer
                    isOpen={isComposerOpen}
                    onClose={() => setIsComposerOpen(false)}
                    tenantId=""
                    prefilledEntity={{ id: entityId, type: "card", name: "Current Customer" }}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["timeline", entityId] })}
                />
            </div>

            <div className="relative">
                {/* The vertical timeline line */}
                <div className="absolute left-8 top-4 bottom-0 w-0.5 bg-border -z-10" />

                <div className="flex flex-col space-y-4 pt-2">
                    {events.map((event) => getTimelineComponent(event))}
                </div>

                {/* Infinite Scroll trigger */}
                <div ref={loadMoreRef} className="h-10 mt-4 flex justify-center items-center">
                    {isFetchingNextPage && (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                    {!hasNextPage && events.length > 0 && (
                        <span className="text-xs text-muted-foreground">סוף ההיסטוריה</span>
                    )}
                </div>
            </div>
        </div>
    );
}
