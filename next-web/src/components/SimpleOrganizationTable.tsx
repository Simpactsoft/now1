
"use client";

import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, Building2 } from "lucide-react";
import { useViewConfig } from "@/components/universal/ViewConfigContext";

interface SimpleOrganizationTableProps {
    data: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onRowClick: (id: string) => void;
    highlightId: string | null;
}

export default function SimpleOrganizationTable({ data, loading, hasMore, loadMore, onRowClick, highlightId }: SimpleOrganizationTableProps) {
    const { sort, dispatch } = useViewConfig();

    const handleSort = (colId: string) => {
        const currentSort = sort.find(s => s.colId === colId);
        let newSortDirection: 'asc' | 'desc' = 'asc';
        if (currentSort && currentSort.sort === 'asc') newSortDirection = 'desc';
        dispatch({ type: 'SET_SORT', payload: [{ colId, sort: newSortDirection }] });
    };

    return (
        <div className="w-full h-full overflow-y-auto pb-20">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-background z-10 shadow-sm">
                    <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-muted/20">
                        <th className="px-6 py-3 font-medium cursor-pointer hover:text-foreground hover:bg-muted/50 transition-colors" onClick={() => handleSort('display_name')}>
                            <div className="flex items-center gap-1">Organization <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                        </th>
                        <th className="px-6 py-3 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                            <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                        </th>
                        <th className="px-6 py-3 font-medium">Industry</th>
                        <th className="px-6 py-3 font-medium">Size</th>
                        <th className="px-6 py-3 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('updated_at')}>
                            <div className="flex items-center gap-1">Last Active <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                    {data.map((org) => {
                        const isHighlighted = highlightId === org.ret_id;
                        return (
                            <tr
                                key={org.ret_id}
                                id={`row-${org.ret_id}`} // Target for scroll
                                onClick={() => onRowClick(org.ret_id)}
                                className={cn(
                                    "group transition-colors cursor-pointer hover:bg-muted/30",
                                    isHighlighted && "bg-primary/5 hover:bg-primary/10"
                                )}
                            >
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        {org.ret_avatar_url ? (
                                            <img src={org.ret_avatar_url} alt="" className="w-8 h-8 rounded-md object-cover border" />
                                        ) : (
                                            <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                        )}
                                        <span className="font-medium text-foreground">{org.ret_name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border",
                                        org.ret_status === 'ACTIVE' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                            org.ret_status === 'CHURNED' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                                "bg-secondary text-secondary-foreground border-border"
                                    )}>
                                        {org.ret_status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-muted-foreground">{org.ret_industry || '-'}</td>
                                <td className="px-6 py-3 text-muted-foreground">{org.ret_size || '-'}</td>
                                <td className="px-6 py-3 text-muted-foreground text-xs">
                                    {org.ret_updated_at ? formatDistanceToNow(new Date(org.ret_updated_at), { addSuffix: true }) : '-'}
                                </td>
                            </tr>
                        );
                    })}
                    {hasMore && (
                        <tr ref={(el) => { if (el && !loading) loadMore(); }}>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                                {loading ? 'Loading more organizations...' : 'Scroll to load more'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
