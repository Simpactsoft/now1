"use client";

import { useRef, useEffect } from "react";
import { MessageSquare, Phone, Mail, MoreHorizontal } from "lucide-react";

import { StatusBadge } from "./StatusBadge";

interface SimplePeopleTableProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onPersonClick: (id: string) => void;
    highlightId: string | null;
    tenantId?: string; // Optional for backward/forward compatibility
}

export default function SimplePeopleTable({
    people,
    loading,
    hasMore,
    loadMore,
    onPersonClick,
    highlightId,
    tenantId
}: SimplePeopleTableProps) {
    const observerTarget = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadMore]);

    return (
        <div className="w-full overflow-auto border border-border rounded-xl bg-card shadow-sm h-[600px]">
            <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0 z-20 backdrop-blur-md">
                    <tr>
                        <th className="w-12 px-4 py-3 font-medium text-center">#</th>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Role</th>
                        <th className="px-6 py-3 font-medium">Tags</th>
                        <th className="px-6 py-3 font-medium text-right">Last Active</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {people.map((person, idx) => {
                        const id = person.ret_id || person.id;
                        const isHighlighted = highlightId === id;

                        return (
                            <tr
                                key={`${id}-${idx}`}
                                onClick={() => onPersonClick(id)}
                                id={`person-${id}`}
                                className={`
                                    group transition-colors cursor-pointer
                                    ${isHighlighted ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/50'}
                                `}
                            >
                                <td className="px-4 py-4 text-xs text-muted-foreground text-center tabular-nums w-12 group-hover:text-foreground">
                                    {idx + 1}
                                </td>
                                <td className="px-6 py-4 font-medium text-foreground max-w-[200px] truncate">
                                    <div className="flex items-center gap-2">
                                        {/* Avatar placeholder */}
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                                            {(person.ret_name || 'U').substring(0, 2)}
                                        </div>
                                        {person.ret_name || 'Unknown'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {tenantId && person.ret_status ? (
                                        <StatusBadge status={person.ret_status} tenantId={tenantId} />
                                    ) : (
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider
                                            ${person.ret_status?.toLowerCase() === 'customer' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                                                person.ret_status?.toLowerCase() === 'churned' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                                                    'bg-blue-500/10 text-blue-600 border border-blue-500/20'}
                                        `}>
                                            {person.ret_status || 'Lead'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {person.ret_role_name || person.role_name || '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {(person.ret_tags || []).slice(0, 3).map((tag: string, i: number) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-secondary rounded text-[10px] text-muted-foreground border border-border/50">
                                                {tag}
                                            </span>
                                        ))}
                                        {(person.ret_tags || []).length > 3 && (
                                            <span className="text-[10px] text-muted-foreground px-1">+{person.ret_tags.length - 3}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">
                                    {person.ret_last_interaction
                                        ? new Date(person.ret_last_interaction).toLocaleDateString()
                                        : '-'
                                    }
                                </td>
                            </tr>
                        );
                    })}

                    {/* Intersection Observer Target */}
                    {hasMore && (
                        <tr ref={observerTarget}>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                {loading ? 'Loading more...' : 'Scroll for more'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
