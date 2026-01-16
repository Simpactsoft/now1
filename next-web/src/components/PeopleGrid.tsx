"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    // IServerSideDatasource, // Removed
    // IServerSideGetRowsParams, // Removed
} from "ag-grid-community";
import { fetchPeople } from "@/app/actions/fetchPeople";
import { useLanguage } from '@/context/LanguageContext';

interface PeopleGridProps {
    tenantId: string;
}

export default function PeopleGrid({ tenantId }: PeopleGridProps) {
    const { t, dir } = useLanguage();
    const gridRef = useRef<AgGridReact>(null);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    // Standard State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isRestoring, setIsRestoring] = useState(false);

    // 1. ONE-TIME MOUNT/RESTORE
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem('people-grid-state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Simplify tenant check for robustness
                    if (parsed.tenantId === tenantId || parsed.tenantId === 'ANY') {
                        console.log("[PeopleGrid] Restored State:", parsed);

                        setSearchTerm(parsed.searchTerm || "");
                        setIsRestoring(true); // Show indicator

                        (window as any).__restoreFocusId = parsed.clickedId;

                        // Force update ref so performSearch sees it immediately
                        // (searchTermRef is defined below, but refs are stable objects, so this works if ref exists)
                        // Wait: searchTermRef is defined AFTER this effect in previous code?
                        // No, order matters. I should move Ref definition UP.
                    }
                }
            } catch (e) {
                console.error("State restore failed", e);
            }
        }
        // Always trigger initial search (it handles empty string correctly)
        // We defer this slightly to ensure Refs are bound? 
        // Actually, performSearch depends on searchTermRef.
    }, [tenantId]);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: "ret_id", headerName: t('id'), minWidth: 120, hide: true },
            {
                field: "ret_name",
                colId: "name",
                headerName: t('fullName'),
                sortable: true,
                flex: 1,
                cellRenderer: (params: any) => {
                    if (!params.data) return null;
                    return (
                        <div
                            onClick={async (e) => {
                                e.preventDefault(); // Prevent accidental bubbling
                                console.log("[PeopleGrid] Row clicked, saving state...");
                                // Direct read from DOM input for absolute truth
                                const currentSearch = (document.querySelector('input[type="text"]') as HTMLInputElement)?.value || '';

                                const state = {
                                    searchTerm: currentSearch,
                                    clickedId: params.data.ret_id,
                                    tenantId: tenantId, // We have valid tenantId in closure now
                                    timestamp: Date.now()
                                };

                                sessionStorage.setItem('people-grid-state', JSON.stringify(state));
                                console.log("[PeopleGrid] State saved:", state);

                                // Navigate
                                // using window.location.assign for hard nav if needed, or router
                                // Since we are in a client component, let's use router if available, or just window.location
                                // window.location is safer given the issues we've had.
                                window.location.href = `/dashboard/people/${params.data.ret_id}`;
                            }}
                            className="flex items-center gap-3 group cursor-pointer w-full h-full"
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                {params.value?.charAt(0)}
                            </div>
                            <span className="font-medium text-white group-hover:text-brand-primary transition-colors underline-offset-4 group-hover:underline">
                                {params.value}
                            </span>
                        </div>
                    );
                }
            },
            {
                field: "ret_contact_info",
                headerName: t('contactDetails'),
                flex: 1,
                valueFormatter: (params) => {
                    const contacts = params.value;
                    if (Array.isArray(contacts) && contacts.length > 0) {
                        return `${contacts.length} ${t('methods')}`;
                    }
                    return t('noContactInfo');
                }
            },
            {
                field: "ret_updated_at",
                headerName: t('lastActive'),
                sortable: true,
                width: 200,
                valueFormatter: (params) => new Date(params.value).toLocaleString()
            },
        ],
        [tenantId, t] // Reframe columnDefs when tenantId changes to ensure closures are fresh
    );


    // Updates the ref immediately
    const searchTermRef = useRef(searchTerm);
    useEffect(() => {
        searchTermRef.current = searchTerm;
    }, [searchTerm]);

    // Manual Data Fetching for Hybrid Mode
    const performSearch = useCallback(async () => {
        setError(null);
        try {
            const queryToUse = searchTermRef.current;
            console.log("[PeopleGrid] Performing search for:", queryToUse);

            const result = await fetchPeople({
                startRow: 0,
                endRow: 100,
                sortModel: [],
                filterModel: {},
                tenantId,
                query: queryToUse
            });

            if (result.error) {
                console.error("[PeopleGrid] Error:", result.error);
                setError(result.error);
            } else {
                if ((result as any).debugInfo) {
                    setDebugInfo((result as any).debugInfo);
                }
                setSearchResults(result.rowData || []);
            }
        } catch (e) {
            console.error("[PeopleGrid] Exception:", e);
            setError("Failed to fetch data");
        } finally {
            setIsRestoring(false);
        }
    }, [tenantId]);

    // Trigger Initial Search (after mount/restore)
    useEffect(() => {
        // If we restored, the Ref might be stale in the very first pass unless we force it.
        // But since we set state, a re-render will happen.
        // Let's rely on the timeout effect or call explicitly?
        // Explicit call is safer for immediate feel.

        // Check if we just restored (by reading storage again or trusting state?)
        // State updates are async.
        // Let's just run performSearch.
        // But we need the UPDATED ref.

        // HACK: Read from session storage directly for the first fetch to ensure sync?
        let initialQuery = "";
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('people-grid-state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.tenantId === tenantId || parsed.tenantId === 'ANY') {
                        initialQuery = parsed.searchTerm || "";
                    }
                } catch { }
            }
        }
        // Force the ref to the restored value immediately for this execution
        if (initialQuery) {
            searchTermRef.current = initialQuery;
        }

        performSearch();
    }, [tenantId, performSearch]);


    // 2. Save state when clicking a person (Using Window Handler) - kept for safety
    useEffect(() => { /* No-op */ }, []);

    // FOCUS RESTORATION EFFECT: Runs whenever data loads
    useEffect(() => {
        const restoreId = (window as any).__restoreFocusId;
        if (restoreId && searchResults.length > 0 && gridRef.current?.api) {
            console.log("[PeopleGrid] Data loaded, attempting restore focus:", restoreId);
            // Give grid time to process row data (safe delay)
            setTimeout(() => {
                if (!gridRef.current?.api) return;
                const api = gridRef.current.api;
                const node = api.getRowNode(restoreId);
                if (node) {
                    api.ensureNodeVisible(node, 'middle');
                    node.setSelected(true);
                    api.setFocusedCell(node.rowIndex!, 'ret_name');
                    console.log("[PeopleGrid] Focus restored!");

                } else {
                    console.warn("[PeopleGrid] Details found but Row ID not in current page:", restoreId);
                }

                // Always clear flags after attempt
                (window as any).__restoreFocusId = null;
                setIsRestoring(false);
                sessionStorage.removeItem('people-grid-state');

            }, 500);
        }
    }, [searchResults]);


    // Trigger Search on Typing (Debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, performSearch]);



    return (
        <div className="flex flex-col gap-4 w-full h-[600px]">
            {/* Search Bar */}
            <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3 px-3 w-full max-w-xl bg-black/20 rounded-xl border border-white/5 focus-within:border-brand-primary/50 focus-within:bg-black/40 transition-all">
                    {/* Search Icon */}
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder')}
                            className="w-full bg-transparent text-white placeholder-slate-500 px-4 py-2 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="ag-theme-quartz-dark w-full h-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                <AgGridReact
                    key={dir} // FORCE RE-MOUNT ON DIR CHANGE to ensure RTL applies
                    theme="legacy"
                    ref={gridRef}
                    columnDefs={columnDefs}
                    defaultColDef={{
                        suppressMovable: false, // Explicitly enable drag
                        sortable: true,
                        flex: 1
                    }}

                    // HYBRID MODE: Server fetches, Client renders.
                    rowData={searchResults}
                    rowModelType="clientSide"

                    animateRows={true}
                    pagination={false} // Infinite scroll or manual paging can be added later
                    getRowId={(params) => params.data.ret_id}
                    rowSelection="single"
                    enableRtl={dir === 'rtl'}
                    localeText={dir === 'rtl' ? { noRowsToShow: t('noRows') } : undefined}
                />
            </div>
        </div>
    );
}
