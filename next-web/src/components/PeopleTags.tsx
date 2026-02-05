"use client";

import { useState, useRef, useEffect } from "react";
import { UserCircle, Briefcase, Building2, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PeopleTagsProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    tenantId: string;
    onPersonClick: (id: string, type?: string) => void;
    highlightId: string | null;
    recentSearches?: string[];
    onSearchHistoryClick?: (term: string) => void;
    onEdit?: (person: any) => void;
    onDelete?: (relId: string) => void;
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
    onSearchHistoryClick,
    onEdit,
    onDelete
}: PeopleTagsProps) {

    return (
        <div className="flex flex-col gap-4 p-3">
            <div className="flex flex-wrap gap-3">
                {people.map((person, idx) => (
                    <TagPill
                        key={`${person.ret_id || person.id}-${idx}`}
                        person={person}
                        highlightId={highlightId}
                        onPersonClick={onPersonClick}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}

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

function TagPill({ person, highlightId, onPersonClick, onEdit, onDelete }: any) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const id = person.ret_id || person.id;
    const isHighlighted = highlightId === id;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'customer': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'churned': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'partner': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
            default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        }
    };

    const status = person.ret_status || 'lead';
    const displayName = person.ret_name || person.name || person.full_name || 'Unknown';
    const avatarUrl = person.ret_avatar_url || person.avatar_url;

    return (
        <div className="relative" ref={menuRef}>
            <div
                onClick={() => onPersonClick(id, person.type || person.ret_type)}
                className={`
                    group flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200 cursor-pointer
                    hover:shadow-md hover:scale-105 active:scale-95
                    ${getStatusColor(status)}
                    ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}
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

                {/* Action Trigger */}
                {(onEdit || onDelete) && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <MoreHorizontal size={14} />
                    </button>
                )}
            </div>

            {/* Menu */}
            {showMenu && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(person); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                        >
                            <Edit size={12} />
                            <span>Edit</span>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(false);
                                if (confirm('Are you sure?')) onDelete(person.relationshipId);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-destructive/10 text-destructive hover:text-destructive flex items-center gap-2"
                        >
                            <Trash2 size={12} />
                            <span>Unlink</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
