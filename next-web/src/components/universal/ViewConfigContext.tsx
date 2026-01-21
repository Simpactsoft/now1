"use client";

import { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// --- Types ---
// --- Types ---
export type FilterOperator = 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'in';
export type SortDirection = 'asc' | 'desc';

export interface FilterCondition {
    id: string; // Unique ID for the filter instance
    field: string;
    operator: FilterOperator;
    value: any;
    isEnabled: boolean;
    defaultOpen?: boolean;
}

export interface SortOption {
    colId: string;
    sort: SortDirection;
}

export interface ViewState {
    viewMode: 'grid' | 'cards' | 'tags' | 'kanban' | 'history';
    layout: 'full' | 'split-v' | 'split-h';
    filters: FilterCondition[];
    sort: SortOption[];
    activeItemId: string | null;
    searchTerm: string; // [NEW] Global search term
    activeSavedView: { id: string; name: string } | null; // [NEW] Track active view
    loadedConfig: Omit<ViewState, 'activeSavedView' | 'loadedConfig' | 'activeItemId'> | null; // [NEW] For dirty checking
}

// --- Actions ---
type Action =
    | { type: 'SET_VIEW_MODE'; payload: ViewState['viewMode'] }
    | { type: 'SET_LAYOUT'; payload: ViewState['layout'] }
    | { type: 'ADD_FILTER'; payload: FilterCondition }
    | { type: 'UPDATE_FILTER'; payload: { id: string; updates: Partial<FilterCondition> } }
    | { type: 'REMOVE_FILTER'; payload: string }
    | { type: 'CLEAR_FILTERS' }
    | { type: 'SET_SORT'; payload: SortOption[] }
    | { type: 'SET_ACTIVE_ITEM'; payload: string | null }
    | { type: 'SET_SEARCH_TERM'; payload: string } // [NEW]
    | { type: 'RESTORE_STATE'; payload: Partial<ViewState>; savedView?: { id: string; name: string } }; // [UPDATED]

// --- Reducer ---
function viewReducer(state: ViewState, action: Action): ViewState {
    switch (action.type) {
        case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload };
        case 'SET_LAYOUT': return { ...state, layout: action.payload };
        case 'ADD_FILTER': return { ...state, filters: [...state.filters, action.payload] };
        case 'UPDATE_FILTER':
            return {
                ...state,
                filters: state.filters.map(f => f.id === action.payload.id ? { ...f, ...action.payload.updates } : f)
            };
        case 'REMOVE_FILTER': return { ...state, filters: state.filters.filter(f => f.id !== action.payload) };
        case 'CLEAR_FILTERS': return { ...state, filters: [] };
        case 'SET_SORT': return { ...state, sort: action.payload };
        case 'SET_ACTIVE_ITEM': return { ...state, activeItemId: action.payload };
        case 'SET_SEARCH_TERM': return { ...state, searchTerm: action.payload };
        case 'RESTORE_STATE':
            const newState = { ...state, ...action.payload };
            if (action.savedView) {
                newState.activeSavedView = action.savedView;
                // Store the config as it was loaded for dirty checking
                newState.loadedConfig = {
                    viewMode: newState.viewMode,
                    layout: newState.layout,
                    filters: newState.filters,
                    sort: newState.sort,
                    searchTerm: newState.searchTerm
                };
            } else {
                // If restoring without a saved view (e.g. URL load), clear active view? 
                // Or maybe URL load IS a "restoration" but not a "saved view".
                // Let's keep it null if not provided.
                if (!newState.filters.length && !newState.searchTerm) {
                    // effectively cleared
                    newState.activeSavedView = null;
                    newState.loadedConfig = null;
                }
            }
            return newState;
        default: return state;
    }
}

// --- Context ---
interface ViewConfigContextType extends ViewState {
    dispatch: React.Dispatch<Action>;
    isModified: boolean; // [NEW] Derived property
}

const ViewConfigContext = createContext<ViewConfigContextType | null>(null);

export function useViewConfig() {
    const context = useContext(ViewConfigContext);
    if (!context) throw new Error("useViewConfig must be used within ViewConfigProvider");
    return context;
}

// --- Logic to check modification ---
function checkIsModified(state: ViewState): boolean {
    if (!state.activeSavedView || !state.loadedConfig) return false;

    // Simple checks
    if (state.viewMode !== state.loadedConfig.viewMode) return true;
    if (state.searchTerm !== state.loadedConfig.searchTerm) return true;
    // if (state.layout !== state.loadedConfig.layout) return true; // Layout usually generic

    // Deep check filters
    if (state.filters.length !== state.loadedConfig.filters.length) return true;
    // This is expensive if we do deep compare every render. 
    // Ideally we rely on JSON stringify for simple objects or just IDs if order matters.
    // For now, let's just JSON stringify the essential parts of filters.
    const f1 = state.filters.map(f => ({ f: f.field, o: f.operator, v: f.value, e: f.isEnabled }));
    const f2 = state.loadedConfig.filters.map(f => ({ f: f.field, o: f.operator, v: f.value, e: f.isEnabled }));
    if (JSON.stringify(f1) !== JSON.stringify(f2)) return true;

    // Check sort
    if (JSON.stringify(state.sort) !== JSON.stringify(state.loadedConfig.sort)) return true;

    return false;
}

// --- Provider ---
export function ViewConfigProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Initial State
    const [state, dispatch] = useReducer(viewReducer, {
        viewMode: 'tags',
        layout: 'full',
        filters: [],
        sort: [],
        activeItemId: null,
        searchTerm: '',
        activeSavedView: null,
        loadedConfig: null
    });

    const isModified = checkIsModified(state);

    // 1. Initialize from URL on Mount (One-time)
    useEffect(() => {
        const view = (searchParams.get('view') as any) || 'tags';
        const layout = (searchParams.get('layout') as any) || 'full';
        const query = searchParams.get('q') || ''; // [NEW]

        // Parse "f_[field]" params into filters
        const initialFilters: FilterCondition[] = [];
        searchParams.forEach((val, key) => {
            if (key.startsWith('f_')) {
                const field = key.replace('f_', '');
                initialFilters.push({
                    id: `init_${field}_${Date.now()}_${Math.random()}`,
                    field,
                    operator: 'equals',
                    value: val,
                    isEnabled: true
                });
            }
        });

        dispatch({
            type: 'RESTORE_STATE',
            payload: { viewMode: view, layout, filters: initialFilters, searchTerm: query }
        });
    }, []);

    // 2. Sync to URL (Effect)
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());

        // View & Layout
        if (state.viewMode !== 'tags') params.set('view', state.viewMode); else params.delete('view');
        if (state.layout !== 'full') params.set('layout', state.layout); else params.delete('layout');

        // Search Term [NEW]
        if (state.searchTerm) params.set('q', state.searchTerm); else params.delete('q');

        // Filters - Clear old
        const keysToDelete: string[] = [];
        params.forEach((_, key) => { if (key.startsWith('f_')) keysToDelete.push(key); });
        keysToDelete.forEach(k => params.delete(k));

        // Filters - Add new
        state.filters.forEach(f => {
            if (f.isEnabled && f.value) {
                params.set(`f_${f.field}`, String(f.value));
            }
        });

        // Compare and Push
        const newUrl = params.toString();
        const currentUrl = searchParams.toString();
        if (newUrl !== currentUrl) {
            router.replace(`${pathname}?${newUrl}`, { scroll: false });
        }
    }, [state, pathname, router, searchParams]);

    return (
        <ViewConfigContext.Provider value={{ ...state, dispatch, isModified }}>
            {children}
        </ViewConfigContext.Provider>
    );
}
