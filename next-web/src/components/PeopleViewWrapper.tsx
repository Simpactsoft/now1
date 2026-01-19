"use client";

import { useState, useEffect, useCallback } from "react";
import PeopleTags from "@/components/PeopleTags";
import FilterChip from "@/components/FilterChip";
import ViewSwitcher from "@/components/ViewSwitcher";
import GroupMatrixDialog from "@/components/GroupMatrixDialog";
import SimplePeopleTable from "@/components/SimplePeopleTable"; // [NEW]
import { fetchPeople } from "@/app/actions/fetchPeople";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { Loader2, Search, UserCircle } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface PeopleViewWrapperProps {
    tenantId: string;
}

export default function PeopleViewWrapper({ tenantId }: PeopleViewWrapperProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // 1. Initialize State from URL
    const initialView = (searchParams.get('view') as 'cards' | 'tags' | 'grid') || 'tags';
    const initialSearch = searchParams.get('search') || "";

    // Parse filters from URL params (prefixed with f_)
    const getInitialFilters = () => {
        const filters: any = {};
        searchParams.forEach((value, key) => {
            if (key.startsWith('f_')) {
                const field = key.replace('f_', '');
                filters[field] = { filterType: 'text', type: 'equals', filter: value };
            }
        });
        return filters;
    };

    const [viewMode, setViewMode] = useState<'cards' | 'tags' | 'grid'>(initialView);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [activeFilters, setActiveFilters] = useState<any>(getInitialFilters);

    // Data State
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    // Highlight Logic
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Counts State
    const [filteredCount, setFilteredCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Fetch Total Unfiltered Count on Mount
    useEffect(() => {
        fetchTotalStats(tenantId).then(res => {
            if (res.totalPeople) setTotalCount(res.totalPeople);
        });
    }, [tenantId]);

    useEffect(() => {
        // Check session storage for last clicked person
        if (typeof window !== 'undefined') {
            const lastId = sessionStorage.getItem('lastClickedPersonId');
            if (lastId) {
                setHighlightId(lastId);
                setTimeout(() => {
                    const el = document.getElementById(`person-${lastId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        }
    }, []);

    const handlePersonClick = (id: string) => {
        sessionStorage.setItem('lastClickedPersonId', id);
        router.push(`/dashboard/people/${id}`);
    };

    // 2. Sync State to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());

        // View
        if (viewMode !== 'tags') params.set('view', viewMode);
        else params.delete('view');

        // Search
        if (searchTerm) params.set('search', searchTerm);
        else params.delete('search');

        // Filters - Clear old first
        const keysToDelete: string[] = [];
        params.forEach((_, key) => {
            if (key.startsWith('f_')) keysToDelete.push(key);
        });
        keysToDelete.forEach(k => params.delete(k));

        // Add current
        Object.entries(activeFilters).forEach(([key, val]: any) => {
            if (val && val.filter) {
                params.set(`f_${key}`, val.filter);
            }
        });

        const newParamsString = params.toString();
        const currentParamsString = searchParams.toString();

        if (newParamsString !== currentParamsString) {
            router.replace(`${pathname}?${newParamsString}`, { scroll: false });
        }
    }, [viewMode, searchTerm, activeFilters, pathname, router, searchParams]);


    // Data Fetching
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(0);
            setPeople([]);
            setHasMore(true);
            loadMore(true);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, activeFilters]);

    const loadMore = useCallback(async (reset = false) => {
        if (loading && !reset) return;
        if (!hasMore && !reset) return;

        setLoading(true);

        try {
            const currentPage = reset ? 0 : page;
            const startRow = currentPage * 50;
            const endRow = startRow + 50;

            const result = await fetchPeople({
                startRow,
                endRow,
                filterModel: activeFilters,
                sortModel: [],
                tenantId,
                query: searchTerm
            });

            if (result.error) {
                console.error("[PeopleViewWrapper] Server Error:", result.error);
            }

            if (result.rowData) {
                if (result.rowData.length < 50) {
                    setHasMore(false);
                }
                setPeople(prev => reset ? result.rowData : [...prev, ...result.rowData]);
                setPage(p => reset ? 1 : p + 1);

                // Update Filtered Count
                if (reset || page === 0) {
                    setFilteredCount(result.rowCount ?? 0);
                }
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error("Failed to load people", e);
        } finally {
            setLoading(false);
        }
    }, [page, loading, hasMore, tenantId, searchTerm, activeFilters]);

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card/50 p-3 rounded-2xl border border-border backdrop-blur-sm shadow-sm sticky top-0 z-30">

                {/* Search */}
                <div className="relative w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search people..."
                        className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:bg-background focus:border-primary/50 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">

                    {/* Result Counts Badge */}
                    <div className="hidden lg:flex flex-col items-end mr-2 px-2 border-r border-border/50">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                            {people.length === 0 && !loading && filteredCount === 0 ? '0' : filteredCount.toLocaleString()}
                            <span className="text-muted-foreground font-normal mx-1">/</span>
                            {totalCount.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Results</span>
                    </div>

                    <GroupMatrixDialog
                        tenantId={tenantId}
                        onApplyFilter={(field, value) => {
                            setActiveFilters((prev: any) => ({
                                ...prev,
                                [field]: { filterType: 'text', type: 'equals', filter: value }
                            }));
                        }}
                    />
                    <div className="h-6 w-px bg-border/50 mx-1 hidden md:block"></div>
                    <ViewSwitcher
                        currentView={viewMode}
                        onViewChange={(v) => {
                            setViewMode(v);
                        }}
                    />
                </div>
            </div>

            {/* Active Filters Display */}
            {Object.keys(activeFilters).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-2 animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase">Filters:</span>
                    {Object.entries(activeFilters).map(([key, val]: any) => (
                        <FilterChip
                            key={key}
                            field={key}
                            value={val.filter}
                            onDelete={() => {
                                const next = { ...activeFilters };
                                delete next[key];
                                setActiveFilters(next);
                            }}
                            onChange={(newValue) => {
                                setActiveFilters((prev: any) => ({
                                    ...prev,
                                    [key]: { ...prev[key], filter: newValue }
                                }));
                            }}
                        />
                    ))}
                    <button onClick={() => setActiveFilters({})} className="text-xs text-muted-foreground hover:text-primary underline">Clear</button>
                </div>
            )}

            {/* View Content */}
            <div className={`transition-all duration-300 min-h-[400px]`}>
                {viewMode === 'tags' ? (
                    <PeopleTags
                        people={people}
                        loading={loading}
                        hasMore={hasMore}
                        loadMore={() => loadMore()}
                        tenantId={tenantId}
                        onPersonClick={handlePersonClick}
                        highlightId={highlightId}
                    />
                ) : viewMode === 'grid' ? (
                    <SimplePeopleTable
                        people={people}
                        loading={loading}
                        hasMore={hasMore}
                        loadMore={() => loadMore()}
                        onPersonClick={handlePersonClick}
                        highlightId={highlightId}
                    />
                ) : (
                    // Simple inline Card View
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                        {people.map((person, idx) => {
                            const id = person.ret_id || person.id;
                            const isHighlighted = highlightId === id;
                            return (
                                <SimpleProfileCard
                                    key={`${id}-${idx}`}
                                    person={person}
                                    onClick={() => handlePersonClick(id)}
                                    isHighlighted={isHighlighted}
                                />
                            );
                        })}
                        {hasMore && <div ref={(node) => { if (node && !loading) loadMore() }} className="h-10 w-full" />}
                    </div>
                )}
            </div>
        </div>
    );
}

// Updated Card to accept onClick and Highlight
function SimpleProfileCard({ person, onClick, isHighlighted }: { person: any, onClick: () => void, isHighlighted: boolean }) {
    const displayName = person.ret_name || person.name || person.full_name || 'Unknown';
    const avatarUrl = person.ret_avatar_url || person.avatar_url;
    const tags = person.ret_tags || [];
    const role = person.role_name || person.role;
    const id = person.ret_id || person.id;

    return (
        <div
            id={`person-${id}`}
            onClick={onClick}
            className={`
                group relative flex flex-col bg-card hover:bg-accent/50 border rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md
                ${isHighlighted ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            `}
        >
            <div className="flex items-center gap-3 mb-4">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover border border-border" />
                ) : (
                    <UserCircle className="w-12 h-12 text-muted-foreground bg-secondary rounded-full p-2" />
                )}
                <div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{displayName}</h3>
                    <p className="text-xs text-muted-foreground">{role}</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {tags.map((tag: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-secondary border border-border">{tag}</span>
                ))}
            </div>
        </div>
    );
}
