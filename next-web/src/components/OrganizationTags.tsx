
"use client";

import { Building2 } from "lucide-react";

interface OrganizationTagsProps {
    data: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onRowClick: (id: string) => void;
    highlightId: string | null;
}

export default function OrganizationTags({
    data,
    loading,
    hasMore,
    loadMore,
    onRowClick,
    highlightId
}: OrganizationTagsProps) {

    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'CHURNED': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'PARTNER': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
            default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        }
    };

    return (
        <div className="flex flex-col gap-4 p-3">
            <div className="flex flex-wrap gap-3">
                {data.map((org, idx) => {
                    const displayName = org.ret_name || 'Unknown';
                    const id = org.ret_id;
                    const status = org.ret_status || 'PROSPECT';
                    const avatarUrl = org.ret_avatar_url;

                    return (
                        <button
                            key={`${id}-${idx}`}
                            onClick={() => onRowClick(id)}
                            className={`
                                group flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200
                                hover:shadow-md hover:scale-105 active:scale-95
                                ${getStatusColor(status)}
                                ${highlightId === id ? 'ring-2 ring-primary ring-offset-2' : ''}
                            `}
                        >
                            <div className="w-6 h-6 rounded-md overflow-hidden bg-white/20 flex-shrink-0 flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-4 h-4 opacity-80" />
                                )}
                            </div>
                            <span className="text-sm font-semibold truncate max-w-[150px]">
                                {displayName}
                            </span>
                        </button>
                    );
                })}

                {hasMore && (
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-1 rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:bg-muted/50 transition-colors text-sm"
                    >
                        {loading ? 'Loading...' : '+ Load More'}
                    </button>
                )}
            </div>
        </div>
    );
}
