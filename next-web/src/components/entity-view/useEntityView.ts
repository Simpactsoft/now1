// useEntityView.ts — Central hook for managing Entity View state
// Merges our ViewConfigContext (URL sync, saved views) with the architect's
// data management (pagination, selection, server-side) approach.

"use client";

import { useState, useMemo, useCallback, useEffect, useReducer, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    ViewMode,
    FilterCondition,
    SortConfig,
    PaginationConfig,
    EntityViewConfig,
    SavedView,
    UseEntityViewOptions,
    FetchDataParams,
    FetchDataResult,
} from './types';

// ==================== Internal State ====================

interface InternalState {
    viewMode: ViewMode;
    layout: 'full' | 'split-v' | 'split-h';
    filters: FilterCondition[];
    sorting: SortConfig[];
    activeItemId: string | null;
    searchTerm: string;
    activeSavedView: { id: string; name: string } | null;
    loadedConfig: Partial<InternalState> | null;
}

type Action =
    | { type: 'SET_VIEW_MODE'; payload: ViewMode }
    | { type: 'SET_LAYOUT'; payload: 'full' | 'split-v' | 'split-h' }
    | { type: 'ADD_FILTER'; payload: FilterCondition }
    | { type: 'UPDATE_FILTER'; payload: { id: string; updates: Partial<FilterCondition> } }
    | { type: 'REMOVE_FILTER'; payload: string }
    | { type: 'CLEAR_FILTERS' }
    | { type: 'SET_SORT'; payload: SortConfig[] }
    | { type: 'SET_ACTIVE_ITEM'; payload: string | null }
    | { type: 'SET_SEARCH_TERM'; payload: string }
    | { type: 'RESTORE_STATE'; payload: Partial<InternalState>; savedView?: { id: string; name: string } };

function viewReducer(state: InternalState, action: Action): InternalState {
    switch (action.type) {
        case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload };
        case 'SET_LAYOUT': return { ...state, layout: action.payload };
        case 'ADD_FILTER': return { ...state, filters: [...state.filters, action.payload] };
        case 'UPDATE_FILTER':
            return {
                ...state,
                filters: state.filters.map(f =>
                    f.id === action.payload.id ? { ...f, ...action.payload.updates } : f
                )
            };
        case 'REMOVE_FILTER': return { ...state, filters: state.filters.filter(f => f.id !== action.payload) };
        case 'CLEAR_FILTERS': return { ...state, filters: [], searchTerm: '' };
        case 'SET_SORT': return { ...state, sorting: action.payload };
        case 'SET_ACTIVE_ITEM': return { ...state, activeItemId: action.payload };
        case 'SET_SEARCH_TERM': return { ...state, searchTerm: action.payload };
        case 'RESTORE_STATE': {
            const newState = { ...state, ...action.payload };
            if (action.savedView) {
                newState.activeSavedView = action.savedView;
                newState.loadedConfig = {
                    viewMode: newState.viewMode,
                    layout: newState.layout,
                    filters: newState.filters,
                    sorting: newState.sorting,
                    searchTerm: newState.searchTerm,
                };
            } else if (!newState.filters.length && !newState.searchTerm) {
                newState.activeSavedView = null;
                newState.loadedConfig = null;
            }
            return newState;
        }
        default: return state;
    }
}

// ==================== Dirty Check ====================

function checkIsModified(state: InternalState): boolean {
    if (!state.activeSavedView || !state.loadedConfig) return false;
    if (state.viewMode !== state.loadedConfig.viewMode) return true;
    if (state.searchTerm !== state.loadedConfig.searchTerm) return true;
    if (state.filters.length !== (state.loadedConfig.filters?.length ?? 0)) return true;

    const f1 = state.filters.map(f => ({ f: f.field, o: f.operator, v: f.value, e: f.isEnabled }));
    const f2 = (state.loadedConfig.filters || []).map(f => ({ f: f.field, o: f.operator, v: f.value, e: f.isEnabled }));
    if (JSON.stringify(f1) !== JSON.stringify(f2)) return true;

    if (JSON.stringify(state.sorting) !== JSON.stringify(state.loadedConfig.sorting || [])) return true;

    return false;
}

// ==================== Main Hook ====================

export function useEntityView<T = any>(options: UseEntityViewOptions<T>): EntityViewConfig<T> {
    const {
        entityType,
        initialData = [],
        initialViewMode = 'tags',
        initialPageSize = 50,
        serverSide = false,
        onFetchData,
        getItemId = (item: any) => item.id || item.ret_id,
        debounceMs = 200,
        validFilterFields,
    } = options;

    // Next.js routing (for URL sync)
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // ---- View State (reducer) ----
    const [viewState, dispatch] = useReducer(viewReducer, {
        viewMode: initialViewMode,
        layout: 'full',
        filters: [],
        sorting: [],
        activeItemId: null,
        searchTerm: '',
        activeSavedView: null,
        loadedConfig: null,
    });

    const isModified = checkIsModified(viewState);

    // ---- Data State ----
    const [data, setData] = useState<T[]>(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // ---- Pagination ----
    const [pagination, setPaginationState] = useState<PaginationConfig>({
        page: 1,
        pageSize: initialPageSize,
    });

    // ---- Selection ----
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // ==================== Sync initialData prop ====================
    useEffect(() => {
        if (!serverSide && initialData.length > 0) {
            setData(initialData);
        }
    }, [initialData, serverSide]);

    // ==================== URL Init (one-time) ====================
    useEffect(() => {
        const view = (searchParams.get('view') as ViewMode) || initialViewMode;
        const layout = (searchParams.get('layout') as any) || 'full';
        const query = searchParams.get('q') || '';

        // Build a set of valid fields for fast lookup
        const validFieldSet = validFilterFields ? new Set(validFilterFields) : null;

        const initialFilters: FilterCondition[] = [];
        searchParams.forEach((val, key) => {
            if (key.startsWith('f_')) {
                const field = key.replace('f_', '');
                // Skip filters that don't belong to this entity type
                if (validFieldSet && !validFieldSet.has(field)) return;
                initialFilters.push({
                    id: `init_${field}_${Date.now()}_${Math.random()}`,
                    field,
                    operator: 'equals',
                    value: val,
                    isEnabled: true,
                });
            }
        });

        dispatch({
            type: 'RESTORE_STATE',
            payload: { viewMode: view, layout, filters: initialFilters, searchTerm: query },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==================== URL Sync (effect) ====================
    // Use a ref to track the last URL we wrote, avoiding the
    // searchParams → replace → searchParams infinite loop.
    const lastPushedUrl = useRef<string>('');

    useEffect(() => {
        const params = new URLSearchParams();

        if (viewState.viewMode !== 'tags') params.set('view', viewState.viewMode);
        if (viewState.layout !== 'full') params.set('layout', viewState.layout);
        if (viewState.searchTerm) params.set('q', viewState.searchTerm);

        // Add active filters
        viewState.filters.forEach(f => {
            if (f.isEnabled && f.value) {
                params.set(`f_${f.field}`, String(f.value));
            }
        });

        const newUrl = params.toString();
        if (newUrl !== lastPushedUrl.current) {
            lastPushedUrl.current = newUrl;
            router.replace(`${pathname}?${newUrl}`, { scroll: false });
        }
    }, [viewState.viewMode, viewState.layout, viewState.searchTerm, viewState.filters, pathname, router]);

    // ==================== Server-Side Data Fetching ====================
    // Use a ref to hold totalRecords/totalPages so updating them does NOT
    // re-trigger fetchData (which caused the infinite loop).
    const fetchIdRef = useRef(0);

    useEffect(() => {
        if (!serverSide || !onFetchData) return;

        const currentFetchId = ++fetchIdRef.current;

        const doFetch = async () => {
            setLoading(true);
            setError(null);

            try {
                const result = await onFetchData({
                    filters: viewState.filters,
                    searchQuery: viewState.searchTerm,
                    sorting: viewState.sorting,
                    pagination: { page: pagination.page, pageSize: pagination.pageSize },
                });

                // Only apply if this is still the latest fetch
                if (currentFetchId !== fetchIdRef.current) return;

                setData(result.data);
                setPaginationState(prev => ({
                    ...prev,
                    totalRecords: result.totalRecords,
                    totalPages: result.totalPages,
                }));
            } catch (err) {
                if (currentFetchId !== fetchIdRef.current) return;
                setError(err instanceof Error ? err : new Error('Failed to fetch data'));
            } finally {
                if (currentFetchId === fetchIdRef.current) {
                    setLoading(false);
                }
            }
        };

        // Debounce slightly to batch rapid filter/search changes
        const timer = setTimeout(doFetch, debounceMs);
        return () => clearTimeout(timer);
        // Only depend on the values that represent a NEW query — not the full
        // pagination object (totalRecords / totalPages would cause a loop).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewState.filters, viewState.searchTerm, viewState.sorting, pagination.page, pagination.pageSize, serverSide, onFetchData]);

    // ==================== Client-Side Filtering ====================
    const filteredData = useMemo(() => {
        if (serverSide) return data;

        let result = [...data];

        // Search
        if (viewState.searchTerm) {
            const query = viewState.searchTerm.toLowerCase();

            if (options.searchFilter) {
                // Use custom search filter if provided
                result = result.filter((item) => options.searchFilter!(item, viewState.searchTerm));
            } else {
                // Default search: check all object values
                result = result.filter((item) =>
                    Object.values(item as any).some((value) =>
                        String(value ?? '').toLowerCase().includes(query)
                    )
                );
            }
        }

        // Filters
        viewState.filters.forEach((filter) => {
            if (!filter.isEnabled || !filter.value) return;

            result = result.filter((item) => {
                const value = (item as any)[filter.field];

                switch (filter.operator) {
                    case 'equals':
                        return String(value).toLowerCase() === String(filter.value).toLowerCase();
                    case 'notEquals':
                        return String(value).toLowerCase() !== String(filter.value).toLowerCase();
                    case 'contains':
                        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'notContains':
                        return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
                    case 'gt':
                        return value > filter.value;
                    case 'lt':
                        return value < filter.value;
                    case 'in': {
                        const vals = filter.value.split(',').map((v: string) => v.trim().toLowerCase());
                        return vals.includes(String(value).toLowerCase());
                    }
                    case 'isEmpty':
                        return !value || value === '';
                    case 'isNotEmpty':
                        return !!value && value !== '';
                    default:
                        return true;
                }
            });
        });

        // Sorting
        if (viewState.sorting.length > 0) {
            result.sort((a, b) => {
                for (const sort of viewState.sorting) {
                    const aVal = (a as any)[sort.colId];
                    const bVal = (b as any)[sort.colId];

                    if (aVal < bVal) return sort.sort === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sort.sort === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [data, viewState.searchTerm, viewState.filters, viewState.sorting, serverSide]);

    // ==================== Client-Side Pagination ====================
    const paginatedData = useMemo(() => {
        if (serverSide) return filteredData;

        const start = (pagination.page - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        return filteredData.slice(start, end);
    }, [filteredData, pagination, serverSide]);

    // Update totalRecords/totalPages (Client-Side)
    useEffect(() => {
        if (!serverSide) {
            const totalRecords = filteredData.length;
            const totalPages = Math.ceil(totalRecords / pagination.pageSize);

            setPaginationState(prev => ({
                ...prev,
                totalRecords,
                totalPages,
            }));
        }
    }, [filteredData.length, pagination.pageSize, serverSide]);

    // ==================== Action Creators ====================

    // -- View --
    const setViewMode = useCallback((mode: ViewMode) => {
        dispatch({ type: 'SET_VIEW_MODE', payload: mode });
    }, []);

    const setLayout = useCallback((layout: 'full' | 'split-v' | 'split-h') => {
        dispatch({ type: 'SET_LAYOUT', payload: layout });
    }, []);

    const setActiveItem = useCallback((id: string | null) => {
        dispatch({ type: 'SET_ACTIVE_ITEM', payload: id });
    }, []);

    // -- Filters --
    const addFilter = useCallback((filter: FilterCondition) => {
        dispatch({ type: 'ADD_FILTER', payload: filter });
        setPaginationState(prev => ({ ...prev, page: 1 }));
    }, []);

    const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
        dispatch({ type: 'UPDATE_FILTER', payload: { id, updates } });
    }, []);

    const removeFilter = useCallback((filterId: string) => {
        dispatch({ type: 'REMOVE_FILTER', payload: filterId });
    }, []);

    const clearFilters = useCallback(() => {
        dispatch({ type: 'CLEAR_FILTERS' });
        setPaginationState(prev => ({ ...prev, page: 1 }));
    }, []);

    const setSearchTerm = useCallback((query: string) => {
        dispatch({ type: 'SET_SEARCH_TERM', payload: query });
    }, []);

    // -- Sort & Pagination --
    const setSorting = useCallback((sorting: SortConfig[]) => {
        dispatch({ type: 'SET_SORT', payload: sorting });
    }, []);

    const setPagination = useCallback((partial: Partial<PaginationConfig>) => {
        setPaginationState(prev => ({ ...prev, ...partial }));
    }, []);

    // -- Selection --
    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }, []);

    const selectAll = useCallback(() => {
        const allIds = paginatedData.map(getItemId);
        setSelectedIds(allIds);
    }, [paginatedData, getItemId]);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    // -- Saved Views --
    const saveView = useCallback(async (name: string) => {
        const view: SavedView = {
            id: Date.now().toString(),
            name,
            filters: viewState.filters,
            sorting: viewState.sorting,
            viewMode: viewState.viewMode,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const savedViews = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
        savedViews.push(view);
        localStorage.setItem(`savedViews_${entityType}`, JSON.stringify(savedViews));
    }, [viewState.filters, viewState.sorting, viewState.viewMode, entityType]);

    const loadView = useCallback(async (viewId: string) => {
        const savedViews: SavedView[] = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
        const view = savedViews.find(v => v.id === viewId);

        if (view) {
            dispatch({
                type: 'RESTORE_STATE',
                payload: {
                    filters: view.filters,
                    sorting: view.sorting,
                    viewMode: view.viewMode,
                },
                savedView: { id: view.id, name: view.name },
            });
        }
    }, [entityType]);

    const deleteView = useCallback(async (viewId: string) => {
        const savedViews: SavedView[] = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
        const filtered = savedViews.filter(v => v.id !== viewId);
        localStorage.setItem(`savedViews_${entityType}`, JSON.stringify(filtered));
    }, [entityType]);

    const restoreState = useCallback((state: Partial<any>, savedView?: { id: string; name: string }) => {
        dispatch({
            type: 'RESTORE_STATE',
            payload: state,
            savedView,
        });
    }, []);

    // -- Refresh --
    const refresh = useCallback(async (reset?: boolean) => {
        if (reset) {
            dispatch({
                type: 'RESTORE_STATE',
                payload: { filters: [], sorting: [], viewMode: initialViewMode, searchTerm: '' },
            });
        }
        // The effect will auto-re-fetch when the state changes.
    }, [initialViewMode]);

    // ==================== Return Config ====================
    return {
        // View State
        viewMode: viewState.viewMode,
        filters: viewState.filters,
        searchTerm: viewState.searchTerm,
        sorting: viewState.sorting,
        pagination,
        selectedIds,
        layout: viewState.layout,
        activeItemId: viewState.activeItemId,

        // Data
        data: serverSide ? data : paginatedData,
        filteredData,
        loading,
        error,

        // Saved View State
        activeSavedView: viewState.activeSavedView,
        isModified,

        // Actions — View
        setViewMode,
        setLayout,
        setActiveItem,

        // Actions — Filters & Search
        addFilter,
        updateFilter,
        removeFilter,
        clearFilters,
        setSearchTerm,

        // Actions — Sort & Pagination
        setSorting,
        setPagination,

        // Actions — Selection
        setSelectedIds,
        toggleSelection,
        selectAll,
        clearSelection,

        // Actions — Saved Views
        saveView,
        loadView,
        deleteView,
        restoreState,

        // Actions — Refresh
        refresh,
    };
}
