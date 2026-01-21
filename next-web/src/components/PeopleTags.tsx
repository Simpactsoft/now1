"use client";

import { UserCircle, Briefcase, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PeopleTagsProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    tenantId: string;
    onPersonClick: (id: string) => void;
    highlightId: string | null;
    recentSearches?: string[];
    onSearchHistoryClick?: (term: string) => void;
}

export default function PeopleTags({
    people,
    loading,
    hasMore,
    loadMore,
    tenantId,
    onPersonClick,
    highlightId,
    recentSearches = [],
    onSearchHistoryClick
}: PeopleTagsProps) {
    // const router = useRouter(); // Removed, using parent handler

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'customer': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'churned': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'partner': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
            default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        }
    };

    console.log(`[PeopleTags] Render. Items: ${people?.length}, Loading: ${loading}`);

    return (
        <div className="flex flex-col gap-4 p-3">

            {/* Recent Searches Section - Always Visible for Debug/UX */}
            {onSearchHistoryClick && (
                <div className="flex flex-col gap-2 mb-2 p-3 bg-secondary/20 rounded-xl border border-border/50 border-dashed">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                        Recent Searches
                    </h3>

                    {recentSearches.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((term, i) => (
                                <button
                                    key={`history-${i}`}
                                    onClick={() => onSearchHistoryClick(term)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 hover:border-primary/30 transition-all text-sm group"
                                >
                                    <span className="font-medium opacity-90">{term}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground italic pl-2">
                            No recent searches. Type in the search bar to add one.
                        </div>
                    )}
                </div>
            )}

            {/* People List */}
            <div className="flex flex-wrap gap-3">
                {people.map((person, idx) => {
                    const displayName = person.ret_name || person.name || person.full_name || 'Unknown';
                    const avatarUrl = person.ret_avatar_url || person.avatar_url;
                    const status = person.ret_status || 'lead';
                    const id = person.ret_id || person.id;

                    return (
                        <button
                            key={`${id}-${idx}`}
                            id={`person-${id}`}
                            onClick={() => onPersonClick(id)}
                            className={`
                                group flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200
                                hover:shadow-md hover:scale-105 active:scale-95
                                ${getStatusColor(status)}
                                ${highlightId === id ? 'ring-2 ring-primary ring-offset-2' : ''}
                            `}
                            title={`${displayName} - ${person.role_name || 'No Role'}`}
                        >
                            {/* Avatar Bubble */}
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-white/20 flex-shrink-0">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle className="w-full h-full p-0.5 opacity-80" />
                                )}
                            </div>

                            {/* Name */}
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
