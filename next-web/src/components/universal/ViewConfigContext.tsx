"use client";

import { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

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
    viewMode: 'grid' | 'cards' | 'tags' | 'kanban';
    layout: 'full' | 'split-v' | 'split-h';
    filters: FilterCondition[];
    sort: SortOption[];
    activeItemId: string | null;
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
    | { type: 'RESTORE_STATE'; payload: Partial<ViewState> };

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
        case 'RESTORE_STATE': return { ...state, ...action.payload };
        default: return state;
    }
}

// --- Context ---
interface ViewConfigContextType extends ViewState {
    dispatch: React.Dispatch<Action>;
}

const ViewConfigContext = createContext<ViewConfigContextType | null>(null);

export function useViewConfig() {
    const context = useContext(ViewConfigContext);
    if (!context) throw new Error("useViewConfig must be used within ViewConfigProvider");
    return context;
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
        activeItemId: null
    });

    // 1. Initialize from URL on Mount (One-time)
    useEffect(() => {
        const view = (searchParams.get('view') as any) || 'tags';
        const layout = (searchParams.get('layout') as any) || 'full';

        // Parse "f_[field]" params into filters
        const initialFilters: FilterCondition[] = [];
        searchParams.forEach((val, key) => {
            if (key.startsWith('f_')) {
                const field = key.replace('f_', '');
                initialFilters.push({
                    id: `init_${field}_${Date.now()}_${Math.random()}`,
                    field,
                    operator: 'equals', // Default to equals for URL params for now
                    value: val,
                    isEnabled: true
                });
            }
        });

        dispatch({
            type: 'RESTORE_STATE',
            payload: { viewMode: view, layout, filters: initialFilters }
        });
    }, []); // Empty dependency to run once on mount

    // 2. Sync to URL (Effect)
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());

        // View & Layout
        if (state.viewMode !== 'tags') params.set('view', state.viewMode); else params.delete('view');
        if (state.layout !== 'full') params.set('layout', state.layout); else params.delete('layout');

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
    }, [state, pathname, router, searchParams]); // Dependencies need check to avoid loops

    return (
        <ViewConfigContext.Provider value={{ ...state, dispatch }}>
            {children}
        </ViewConfigContext.Provider>
    );
}
