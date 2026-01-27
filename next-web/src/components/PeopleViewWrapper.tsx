"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PeopleTags from "@/components/PeopleTags";
// import FilterChip from "@/components/FilterChip"; // Replaced by FilterStrip
// import ViewSwitcher from "@/components/ViewSwitcher"; // Integrated into Context/Toolbar
import GroupMatrixDialog from "@/components/GroupMatrixDialog";
import SimplePeopleTable from "@/components/SimplePeopleTable";
import { fetchPeople } from "@/app/actions/fetchPeople";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { Search, X, Filter, LayoutGrid, List, Kanban, Tag, MoreHorizontal, SlidersHorizontal, ArrowUpDown, ChevronDown, UserCircle, CreditCard, Database, RotateCcw, History } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ViewConfigProvider, useViewConfig, FilterCondition } from "@/components/universal/ViewConfigContext";
import SmartChip from "@/components/universal/SmartChip";
import AddFilterCommand from "@/components/universal/AddFilterCommand";
// import FilterStrip from "@/components/universal/FilterStrip"; // Removed
import SavedViewsMenu from "@/components/SavedViewsMenu";
// ResponsiveActionsMenu is defined inline below
import AddPersonDialog from "./AddPersonDialog";
import { getSearchHistory, addToSearchHistory, clearSearchHistory } from "@/app/actions/searchHistory";
import * as Popover from "@radix-ui/react-popover";
import { createBrowserClient } from "@supabase/ssr";

// --- Types ---
interface PeopleViewWrapperProps {
    tenantId: string;
}

// --- Helper Components ---
function ResponsiveActionsMenu({ viewMode, dispatch, total, filtered }: { viewMode: string, dispatch: any, total: number, filtered: number }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button className="p-2 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content className="z-50 w-48 p-2 bg-popover text-popover-foreground rounded-xl border border-border shadow-lg animate-in fade-in zoom-in-95" align="end" sideOffset={5}>
                    {/* View Switcher Mobile */}
                    <div className="mb-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">View Mode</div>
                        <div className="flex bg-secondary/30 p-1 rounded-lg border border-border/50 gap-1">
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'tags' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'tags' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <List className="w-4 h-4" />
                            </button>
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'cards' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'cards' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <CreditCard className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-border/50 pt-2 px-1">
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Results:</span>
                            <span className="font-medium text-foreground">{filtered.toLocaleString()} / {total.toLocaleString()}</span>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
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
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Global View State
    const { viewMode, filters, sort, dispatch, searchTerm, activeSavedView, isModified } = useViewConfig();

    // Focus ref for input to allow clicking container to focus
    const inputRef = useRef<HTMLInputElement>(null);

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
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    // Status Options State (Lifted for Performance)
    const [statusOptions, setStatusOptions] = useState<any[]>([]);

    // Fetch Status Options Once
    useEffect(() => {
        if (!tenantId) return;
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options", err));
    }, [tenantId]);

    // Initial Hydration Fix
    useEffect(() => {
        setLastRefreshed(new Date());
    }, []);

    // Handle New Person Creation (via URL param)
    useEffect(() => {
        const createdId = searchParams.get('created');
        if (createdId) {
            console.log(`[PeopleViewWrapper] Detected createdId: ${createdId}`);
            setHighlightId(createdId);

            // Clear filters to ensure visibility
            // We preserve viewMode but reset everything else
            dispatch({
                type: 'RESTORE_STATE',
                payload: { filters: [], sort: [], searchTerm: '', viewMode: viewMode }
            });

            // Trigger refresh to load the new person
            // We set a small timeout to let the DB settle if needed, though revalidatePath was called.
            setTimeout(() => {
                loadMore(true);
            }, 500);

            // Clear the param
            const params = new URLSearchParams(searchParams.toString());
            params.delete('created');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, pathname, router]);


    // Search Interaction State
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Split Search History:
    // DB (view): 100 items - Now used for dropdown too
    const [dbSearchHistory, setDbSearchHistory] = useState<string[]>([]);

    const [showHistory, setShowHistory] = useState(false);

    // Get current user ID for secure submission
    const [userId, setUserId] = useState<string | null>(null);
    useEffect(() => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    }, []);

    // Load DB History (Async) - Moved after userId definition
    useEffect(() => {
        if (!tenantId) return;
        getSearchHistory(tenantId, userId || undefined).then(res => {
            if (res.success && res.history) {
                setDbSearchHistory(res.history as string[]);
            }
        });
    }, [tenantId, lastRefreshed, userId]);

    const handleAddHistory = async (term: string) => {
        if (!term || term.trim().length < 2) return;

        // Add to DB (Async)
        try {
            // Pass userId explicitly to bypass server-side session issues with SECURITY DEFINER
            const res = await addToSearchHistory(tenantId, term, userId || undefined);

            if (res.success) {
                // If successful, refresh DB history to include it
                getSearchHistory(tenantId, userId || undefined).then(r => {
                    if (r.success && r.history) setDbSearchHistory(r.history as string[]);
                });
            }
        } catch (e) {
            console.warn("SearchHistory: DB Sync failed", e);
        }
    };

    const handleClearHistory = async () => {
        setDbSearchHistory([]);
        await clearSearchHistory(tenantId);
    };

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
                const filterObj = { filterType: 'text', type: f.operator, filter: f.value };

                if (model[f.field]) {
                    // If exists, convert to array or push to array
                    if (Array.isArray(model[f.field])) {
                        model[f.field].push(filterObj);
                    } else {
                        model[f.field] = [model[f.field], filterObj];
                    }
                } else {
                    model[f.field] = filterObj;
                }
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

    // Loading Lock Ref to prevent "Accumulation" of requests
    const loadingRef = useRef(false);
    // Cooldown Ref to prevent rapid-fire sequential requests
    const lastLoadTimeRef = useRef(0);

    const loadMore = useCallback(async (reset = false) => {
        // Immediate check against ref (synchronous)
        if (loadingRef.current && !reset) return;
        if (!hasMore && !reset) return;

        // Cooldown check (skip if resetting)
        // If we just finished loading < 500ms ago, don't load again immediately.
        // This gives the user time to see the new data and prevents "momentum" scrolling from triggering multiple pages.
        if (!reset && Date.now() - lastLoadTimeRef.current < 500) {
            return;
        }

        // Set Lock
        loadingRef.current = true;
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
                setLastRefreshed(new Date());
            } else if (!result.error) {
                setHasMore(false);
            }
        } catch (e: any) {
            console.error("Failed to load people", e);
            setError(e.message || "Unknown error occurred");
            setHasMore(false);
        } finally {
            setLoading(false);
            // Release Lock
            loadingRef.current = false;
            // Set cooldown timestamp
            lastLoadTimeRef.current = Date.now();
        }
    }, [page, hasMore, tenantId, searchTerm, getFilterModel, sort]);

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            {/* Standard Toolbar */}
            <div className="flex flex-col gap-2 bg-card/50 p-3 rounded-2xl border border-border backdrop-blur-sm shadow-sm sticky top-0 z-30">

                {/* Top Row: Actions & Stats */}
                <div className="flex items-center justify-between w-full">
                    {/* Left: Stats or Title (Moved Stats here for visibility) */}
                    <div className="flex items-center gap-2">
                        {/* Results Count */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-foreground tabular-nums">
                                {people.length === 0 && !loading && filteredCount === 0 ? '0' : filteredCount.toLocaleString()}
                                <span className="text-muted-foreground font-normal mx-1">/</span>
                                {totalCount.toLocaleString()}
                            </span>

                            <button
                                onClick={() => loadMore(true)}
                                disabled={loading}
                                className="group flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/30 hover:bg-secondary border border-transparent hover:border-border transition-all disabled:opacity-50"
                                title={lastRefreshed ? `Last updated: ${lastRefreshed.toLocaleTimeString()}` : ''}
                            >
                                <RotateCcw className={`w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`} />
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline-block">
                                    {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Debug SQL Button */}
                        <button
                            onClick={() => {
                                const model = getFilterModel();
                                let sql = `SELECT count(*) FROM cards p WHERE p.tenant_id = '${tenantId}' AND p.type = 'person'`;
                                if (searchTerm) {
                                    if (searchTerm.length < 3) sql += ` AND lower(p.display_name) LIKE '${searchTerm.toLowerCase()}%'`;
                                    else sql += ` AND p.display_name ILIKE '%${searchTerm}%'`;
                                }
                                const buildInClause = (filterVal: string | undefined) => {
                                    if (!filterVal) return null;
                                    return `(${filterVal.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(', ')})`;
                                };
                                if (model.name) {
                                    const vals = Array.isArray(model.name) ? model.name.map((o: any) => o.filter) : [model.name.filter];
                                    vals.forEach((val: string) => {
                                        if (val.length < 3) sql += ` AND lower(p.display_name) LIKE '${val.toLowerCase()}%'`;
                                        else sql += ` AND p.display_name ILIKE '%${val}%'`;
                                    });
                                }
                                if (model.status) { const inList = buildInClause(model.status.filter); if (inList) sql += ` AND lower(p.status) IN ${inList}`; }
                                if (model.role_name) { const inList = buildInClause(model.role_name.filter); if (inList) sql += ` AND EXISTS (SELECT 1 FROM party_memberships pm WHERE pm.person_id = p.id AND lower(pm.role_name) IN ${inList})`; }
                                if (model.tags) { const inList = buildInClause(model.tags.filter); if (inList) sql += ` AND p.tags && ARRAY[${inList}]::text[]`; }
                                console.log("[Debug SQL]", sql);
                                navigator.clipboard.writeText(sql)
                                    .then(() => alert("SQL copied to clipboard! Check console for details."))
                                    .catch(() => window.prompt("SQL (Copy manually):", sql));
                            }}
                            className="p-2 text-muted-foreground hover:text-primary transition-colors hidden md:block" // Hidden on mobile to save space
                            title="Generate Debug SQL"
                        >
                            <Database className="w-4 h-4" />
                        </button>

                        <div className="h-6 w-px bg-border/50 mx-1 hidden md:block"></div>

                        {/* View Switcher (Desktop) */}
                        <div className="hidden md:flex bg-secondary/50 p-1 rounded-lg border border-border/50">
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

                        {/* Mobile Actions/More */}
                        <div className="">
                            <ResponsiveActionsMenu
                                viewMode={viewMode}
                                dispatch={dispatch}
                                total={totalCount}
                                filtered={filteredCount}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Search & Filters */}
                <div
                    className="flex flex-wrap items-center gap-2 w-full bg-secondary/50 border border-border rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:bg-background transition-all"
                    onClick={() => inputRef.current?.focus()}
                >
                    {/* Saved View Chip / Trigger */}
                    <div className={`
                        group flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border transition-all select-none mr-1
                        ${activeSavedView
                            ? 'bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-secondary/30 border-transparent hover:bg-secondary/50 hover:border-border text-muted-foreground'}
                    `}>
                        <SavedViewsMenu
                            tenantId={tenantId}
                            trigger={
                                <button className="flex items-center gap-1.5 text-xs font-medium px-1 outline-none">
                                    {activeSavedView ? (
                                        <>
                                            <span className="opacity-70 uppercase tracking-wider text-[10px]">View:</span>
                                            <span className="font-bold truncate max-w-[100px]">{activeSavedView.name}</span>
                                            {isModified && <span className="text-xs opacity-70" title="Unsaved changes">*</span>}
                                        </>
                                    ) : (
                                        <Filter className="w-3.5 h-3.5 opacity-70" />
                                    )}
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                            }
                        />
                        {activeSavedView && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Clear active view by restoring without one
                                    dispatch({ type: 'RESTORE_STATE', payload: {}, savedView: undefined });
                                    // Or implement a dedicated RESET_VIEW action if needed, but for now this clears the "Active View" tracker
                                    // actually we want to KEEP current filters but just detach from the Saved View? or Reset to "All People" default?
                                    // Let's reset to default state.
                                    dispatch({
                                        type: 'RESTORE_STATE',
                                        payload: { filters: [], sort: [], viewMode: 'tags', searchTerm: '' }
                                    });
                                }}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors ml-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Active Chips */}
                    {/* Always Render Global Search Chip (Inline Input) */}
                    <div className={`
                        group flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border transition-all mr-1 relative
                        ${searchTerm
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-background border-border hover:border-primary/50 text-muted-foreground focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10'}
                    `}>
                        <Search className={`w-3.5 h-3.5 shrink-0 ${searchTerm ? 'opacity-70' : 'opacity-50'}`} />
                        <input
                            type="text"
                            placeholder="Type to search..."
                            className="bg-transparent outline-none text-xs font-medium placeholder:text-muted-foreground/50 min-w-[100px] w-auto max-w-[200px]"
                            value={searchTerm}
                            onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value })}
                            onFocus={() => setShowHistory(true)}
                            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddHistory(searchTerm);
                                    setShowHistory(false);
                                }
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
                                    inputRef.current?.focus(); // Keep focus
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors shrink-0 cursor-pointer"
                                title="Clear Search"
                            >
                                <X className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                            </button>
                        )}


                        {/* Recent Searches Dropdown & Autocomplete */}
                        {showHistory && (
                            (() => {
                                const filteredHistory = searchTerm
                                    ? dbSearchHistory.filter(h => h.toLowerCase().includes(searchTerm.toLowerCase()))
                                    : dbSearchHistory;

                                if (filteredHistory.length === 0) return null;

                                return (
                                    <div className="absolute top-[calc(100%+4px)] left-0 w-[300px] bg-popover text-popover-foreground rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[300px]">
                                        <div className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-3 py-2 flex justify-between items-center bg-popover/95 backdrop-blur-sm z-10 border-b shrink-0">
                                            <span>{searchTerm ? 'SUGGESTIONS' : 'RECENT SEARCHES'}</span>
                                            {!searchTerm && (
                                                <button onMouseDown={(e) => { e.preventDefault(); handleClearHistory(); }} className="hover:text-destructive transition-colors">Clear All</button>
                                            )}
                                        </div>
                                        <div className="flex flex-col overflow-y-auto">
                                            {filteredHistory.map((term, i) => (
                                                <button
                                                    key={i}
                                                    className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50 text-left transition-colors group/item border-b border-border/30 last:border-0"
                                                    onMouseDown={(e) => {
                                                        // Prevent blur and select
                                                        e.preventDefault();
                                                        dispatch({ type: 'SET_SEARCH_TERM', payload: term });
                                                        handleAddHistory(term); // Bump / Save
                                                        setShowHistory(false);
                                                    }}
                                                >
                                                    <History className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/item:text-primary/50 shrink-0" />
                                                    <span className="truncate">
                                                        {term}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    {filters.map((filter) => (
                        <SmartChip
                            key={filter.id}
                            filter={filter}
                            onUpdate={(updates) => dispatch({ type: 'UPDATE_FILTER', payload: { id: filter.id, updates } })}
                            onRemove={() => dispatch({ type: 'REMOVE_FILTER', payload: filter.id })}
                            dynamicOptions={{
                                status: statusOptions
                            }}
                        />
                    ))}

                    {/* Add Filter Trigger */}
                    <AddFilterCommand
                        minimal={true}
                        onSelectField={(field) => {
                            if (field === 'search') {
                                setIsSearchOpen(true);
                            } else {
                                dispatch({
                                    type: 'ADD_FILTER',
                                    payload: {
                                        id: `new_${field}_${Date.now()}`,
                                        field,
                                        operator: 'equals',
                                        value: '',
                                        isEnabled: true,
                                        defaultOpen: true
                                    }
                                });
                            }
                        }}
                    />

                    {/* Removed Persistent Input */}
                </div>
            </div>

            {/* Universal Filter Strip - Removed and Integrated above */}
            {/* <FilterStrip /> */}

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
                        recentSearches={dbSearchHistory.slice(0, 10)} // In TAGS view we show top 10 DB history items
                        onSearchHistoryClick={(term) => {
                            dispatch({ type: 'SET_SEARCH_TERM', payload: term });
                            handleAddHistory(term);
                        }}
                    />
                ) : viewMode === 'grid' ? (
                    <SimplePeopleTable
                        people={people}
                        loading={loading}
                        hasMore={hasMore}
                        loadMore={() => loadMore()}
                        onPersonClick={handlePersonClick}
                        highlightId={highlightId}
                        tenantId={tenantId}
                        statusOptions={statusOptions}
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
                ${isHighlighted ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/50'}
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
