"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PeopleTags from "@/components/PeopleTags";
// import FilterChip from "@/components/FilterChip"; // Replaced by FilterStrip
// import ViewSwitcher from "@/components/ViewSwitcher"; // Integrated into Context/Toolbar
import GroupMatrixDialog from "@/components/GroupMatrixDialog";
import SimplePeopleTable from "@/components/SimplePeopleTable";
import { fetchPeople } from "@/app/actions/fetchPeople";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { Search, UserCircle, LayoutGrid, List, CreditCard, Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { ViewConfigProvider, useViewConfig, FilterCondition } from "@/components/universal/ViewConfigContext";
import FilterStrip from "@/components/universal/FilterStrip";

// --- Types ---
interface PeopleViewWrapperProps {
    tenantId: string;
}

// --- Wrapper Component (Provider) ---
export default function PeopleViewWrapper({ tenantId }: PeopleViewWrapperProps) {
    return (
        <ViewConfigProvider>
            <PeopleViewContent tenantId={tenantId} />
        </ViewConfigProvider>
    );
}

// --- Content Component (Logic) ---
function PeopleViewContent({ tenantId }: PeopleViewWrapperProps) {
    const router = useRouter();

    // Global View State
    const { viewMode, filters, sort, dispatch } = useViewConfig();

    // Local Search State (Immediate UI)
    const [searchTerm, setSearchTerm] = useState("");

    // Data State
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [error, setError] = useState<string | null>(null);

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

    // Restore Highlight
    useEffect(() => {
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

    // Helper: Convert FilterCondition[] -> API Object
    const getFilterModel = useCallback(() => {
        const model: any = {};
        filters.forEach(f => {
            if (f.isEnabled && f.value) {
                // If multiple filters for same field, join them? or last wins?
                // API expects comma separated for Multi-Select. 
                // Currently SmartChip handles one value. 
                // If user adds two chips for 'Status', we might need to merge them.
                // For simplistic V1: Last wins or we merge.
                // Let's simple bind:
                model[f.field] = { filterType: 'text', type: f.operator, filter: f.value };
            }
        });
        return model;
    }, [filters]);

    // Data Fetching Trigger
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(0);
            setPeople([]);
            setHasMore(true);
            setError(null);
            loadMore(true);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, filters]); // Trigger on global filter changes

    const loadMore = useCallback(async (reset = false) => {
        if (loading && !reset) return;
        if (!hasMore && !reset) return;

        setLoading(true);
        if (reset) setError(null);

        try {
            const currentPage = reset ? 0 : page;
            const startRow = currentPage * 50;
            const endRow = startRow + 50;

            const activeFilterModel = getFilterModel();

            const result = await fetchPeople({
                startRow,
                endRow,
                filterModel: activeFilterModel,
                sortModel: sort, // Pass the active sort state
                tenantId,
                query: searchTerm
            });

            if (result.error) {
                console.error("[PeopleViewWrapper] Server Error:", result.error);
                setError(result.error);
                setHasMore(false);
            }

            if (result.rowData) {
                if (result.rowData.length < 50) {
                    setHasMore(false);
                }
                setPeople(prev => reset ? result.rowData : [...prev, ...result.rowData]);
                setPage(p => reset ? 1 : p + 1);

                if (reset || page === 0) {
                    setFilteredCount(result.rowCount ?? 0);
                }
            } else if (!result.error) {
                setHasMore(false);
            }
        } catch (e: any) {
            console.error("Failed to load people", e);
            setError(e.message || "Unknown error occurred");
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [page, loading, hasMore, tenantId, searchTerm, getFilterModel]);

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            {/* Standard Toolbar */}
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
                    {/* Results Count */}
                    <div className="hidden lg:flex flex-col items-end mr-2 px-2 border-r border-border/50">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                            {people.length === 0 && !loading && filteredCount === 0 ? '0' : filteredCount.toLocaleString()}
                            <span className="text-muted-foreground font-normal mx-1">/</span>
                            {totalCount.toLocaleString()}


                        </span>
                    </div>

                    {/* Debug SQL Button (Temporary) */}
                    <button
                        onClick={() => {
                            const model = getFilterModel();
                            let sql = `SELECT count(*) FROM parties p WHERE p.tenant_id = '${tenantId}' AND p.type = 'person'`;

                            // Global Search
                            if (searchTerm) {
                                if (searchTerm.length < 3) {
                                    sql += ` AND lower(p.display_name) LIKE '${searchTerm.toLowerCase()}%'`;
                                } else {
                                    sql += ` AND p.display_name ILIKE '%${searchTerm}%'`;
                                }
                            }

                            // Helper for Multi-Select + Trim + Lower
                            const buildInClause = (filterVal: string | undefined): string | null => {
                                if (!filterVal) return null;
                                // Split by comma, trim, lower, quote
                                const parts = filterVal.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(', ');
                                return `(${parts})`;
                            };

                            // Name Column Filter (Hybrid)
                            if (model.name) {
                                const val = model.name.filter;
                                if (val.length < 3) {
                                    sql += ` AND lower(p.display_name) LIKE '${val.toLowerCase()}%'`;
                                } else {
                                    sql += ` AND p.display_name ILIKE '%${val}%'`;
                                }
                            }

                            // Status (Multi-Select Support)
                            if (model.status) {
                                const inList = buildInClause(model.status.filter);
                                if (inList) sql += ` AND lower(p.status) IN ${inList}`;
                            }

                            // Role (Multi-Select Support)
                            if (model.role_name) {
                                const inList = buildInClause(model.role_name.filter);
                                // Note: In DB logic we optimize this, but for verify we use standard EXISTS
                                if (inList) sql += ` AND EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND lower(pm.role_name) IN ${inList})`;
                            }

                            // Tags
                            if (model.tags) {
                                const inList = buildInClause(model.tags.filter);
                                if (inList) sql += ` AND p.tags && ARRAY[${inList}]::text[]`; // Approximate check
                            }

                            window.prompt("Generated Debug SQL (Copy this):", sql);
                        }}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                        title="Generate Debug SQL"
                    >
                        <Database className="w-4 h-4" />
                    </button>

                    <GroupMatrixDialog
                        tenantId={tenantId}
                        onApplyFilter={(field, value) => {
                            // Bridge Legacy Dialog to New Context
                            dispatch({
                                type: 'ADD_FILTER',
                                payload: {
                                    id: `matrix_${field}_${Date.now()}`,
                                    field,
                                    operator: 'equals',
                                    value,
                                    isEnabled: true
                                }
                            });
                        }}
                    />

                    <div className="h-6 w-px bg-border/50 mx-1 hidden md:block"></div>

                    {/* Integrated View Switcher */}
                    <div className="flex bg-secondary/50 p-1 rounded-lg border border-border/50">
                        <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'tags' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'tags' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            <List className="w-4 h-4" />
                        </button>
                        <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'cards' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            <CreditCard className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Universal Filter Strip */}
            <FilterStrip />

            {/* Content Area */}
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
                        <InfiniteLoadTrigger hasMore={hasMore} loading={loading} loadMore={() => loadMore()} />
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="p-4 text-center text-destructive bg-destructive/10 rounded-lg mx-4 mt-4">
                        <p className="font-semibold">Error loading data</p>
                        <p className="text-sm opacity-80">{error}</p>
                        <button
                            onClick={() => loadMore(true)}
                            className="mt-2 px-4 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper Component for Intersection Observer
function InfiniteLoadTrigger({ hasMore, loading, loadMore }: { hasMore: boolean, loading: boolean, loadMore: () => void }) {
    const observerTarget = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) loadMore();
            },
            { threshold: 0.1, rootMargin: '100px' }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loading, loadMore]);

    if (!hasMore) return null;
    return <div ref={observerTarget} className="h-10 w-full flex justify-center p-4 text-muted-foreground">{loading ? 'Loading...' : ''}</div>;
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


