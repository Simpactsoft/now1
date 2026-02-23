import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchActivityStream, ActivityStreamCursor } from "@/app/actions/activity-stream-actions";
import { createClient } from "@/lib/supabase/client";

export function useActivityStream(entityId: string, limit: number = 20) {
    const queryClient = useQueryClient();
    const queryKey = ["timeline", entityId];

    const query = useInfiniteQuery({
        queryKey,
        initialPageParam: null as ActivityStreamCursor | null,
        queryFn: async ({ pageParam }: { pageParam: unknown }) => {
            const result = await fetchActivityStream(entityId, limit, pageParam as ActivityStreamCursor | null);
            if (!result.success) {
                throw new Error(result.error);
            }
            return {
                events: result.data.items,
                nextCursor: result.data.nextCursor,
            };
        },
        getNextPageParam: (lastPage: any) => lastPage.nextCursor || undefined,
    });

    const supabase = createClient();

    useEffect(() => {
        if (!entityId) return;

        const channel = supabase
            .channel(`timeline-${entityId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "activity_stream",
                    filter: `entity_id=eq.${entityId}`,
                },
                (payload) => {
                    queryClient.setQueryData(["timeline", entityId], (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page: any, i: number) =>
                                i === 0
                                    ? { ...page, events: [payload.new, ...page.events] }
                                    : page
                            ),
                        };
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "activity_stream",
                    filter: `entity_id=eq.${entityId}`,
                },
                (payload) => {
                    queryClient.setQueryData(["timeline", entityId], (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                events: page.events.map((event: any) =>
                                    event.id === payload.new.id ? payload.new : event
                                ),
                            })),
                        };
                    });
                }
            );

        const timeoutId = setTimeout(() => {
            channel.subscribe();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    }, [entityId, queryClient, supabase]);

    return query;
}
