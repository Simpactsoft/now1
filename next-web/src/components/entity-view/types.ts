// types.ts — Centralized type definitions for the Entity View System
// Merges our existing ViewConfigContext types with the architect's Generics approach.

import { ReactNode } from 'react';

// ==================== Core Enums ====================

export type ViewMode = 'grid' | 'cards' | 'tags' | 'kanban' | 'history' | 'tree';

export type FilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'gt'
    | 'lt'
    | 'between'
    | 'in'
    | 'isEmpty'
    | 'isNotEmpty';

export type SortDirection = 'asc' | 'desc';

// ==================== Filter & Sort ====================

export interface FilterCondition {
    id: string;
    field: string;
    operator: FilterOperator;
    value: any;
    label?: string;
    color?: string;
    isEnabled: boolean;
    defaultOpen?: boolean;
}

export interface SortConfig {
    colId: string;
    sort: SortDirection;
}

// ==================== Pagination ====================

export interface PaginationConfig {
    page: number;
    pageSize: number;
    totalPages?: number;
    totalRecords?: number;
}

// ==================== Saved Views ====================

export interface SavedView {
    id: string;
    name: string;
    filters: FilterCondition[];
    sorting?: SortConfig[];
    columns?: string[];
    viewMode: ViewMode;
    isDefault?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ==================== Search History ====================

export interface SearchHistoryItem {
    id: string;
    query: string;
    timestamp: Date;
    resultCount?: number;
}

// ==================== Column Definition (Generic) ====================

export interface ColumnDef<T = any> {
    field: keyof T | string;
    headerName: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    flex?: number;
    sortable?: boolean;
    filterable?: boolean;
    resizable?: boolean;
    editable?: boolean;
    hide?: boolean;
    pinned?: 'left' | 'right';
    checkboxSelection?: boolean;
    cellRenderer?: (params: { value: any; data: T }) => ReactNode;
    valueGetter?: (data: T) => any;
    valueFormatter?: (value: any) => string;
    headerClass?: string;
    cellClass?: string | ((params: { value: any; data: T }) => string);
    cellDataType?: string;
}

// ==================== Entity View Config (Generic) ====================
// This is the shape returned by useEntityView<T>

export interface EntityViewConfig<T = any> {
    // View State
    viewMode: ViewMode;
    filters: FilterCondition[];
    searchTerm: string;
    sorting: SortConfig[];
    pagination: PaginationConfig;
    selectedIds: string[];
    layout: 'full' | 'split-v' | 'split-h';
    activeItemId: string | null;

    // Data
    data: T[];
    filteredData: T[];
    loading: boolean;
    error?: Error | null;

    // Saved View State
    activeSavedView: { id: string; name: string } | null;
    isModified: boolean;

    // Actions — View
    setViewMode: (mode: ViewMode) => void;
    setLayout: (layout: 'full' | 'split-v' | 'split-h') => void;
    setActiveItem: (id: string | null) => void;

    // Actions — Filters & Search
    addFilter: (filter: FilterCondition) => void;
    updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
    removeFilter: (filterId: string) => void;
    clearFilters: () => void;
    setSearchTerm: (query: string) => void;

    // Actions — Sort & Pagination
    setSorting: (sorting: SortConfig[]) => void;
    setPagination: (pagination: Partial<PaginationConfig>) => void;

    // Actions — Selection
    setSelectedIds: (ids: string[]) => void;
    toggleSelection: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;

    // Actions — Saved Views
    saveView: (name: string) => Promise<void>;
    loadView: (viewId: string) => Promise<void>;
    deleteView: (viewId: string) => Promise<void>;
    restoreState: (state: Partial<EntityViewConfig<T>>, savedView?: { id: string; name: string }) => void;

    // Actions — Refresh
    refresh: (reset?: boolean) => void | Promise<void>;
}

// ==================== Render Props (Generic) ====================

export interface GridRenderProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    loading: boolean;
    selectedIds: string[];
    sorting: SortConfig[];
    pagination: PaginationConfig;
    onRowClick?: (item: T) => void;
    onSelectionChange: (ids: string[]) => void;
    onSortChange: (sorting: SortConfig[]) => void;
    onPaginationChange: (pagination: Partial<PaginationConfig>) => void;
}

export interface CardsRenderProps<T> {
    data: T[];
    loading: boolean;
    selectedIds: string[];
    onCardClick?: (item: T) => void;
    onSelectionChange: (ids: string[]) => void;
    renderCard: (item: T, selected: boolean) => ReactNode;
}

export interface TagsRenderProps<T> {
    data: T[];
    loading: boolean;
    groupBy?: keyof T;
    onTagClick?: (item: T) => void;
}

export interface TreeRenderProps<T> {
    data: T[];
    loading: boolean;
    selectedIds: string[];
    onRowClick?: (item: T) => void;
    onSelectionChange: (ids: string[]) => void;
    getDataPath: (item: T) => string[];
    autoGroupColumnDef?: any;
}

// ==================== Layout Props (Generic) ====================

export interface EntityViewLayoutProps<T = any> {
    // Basic Config
    title?: string;
    entityType: string;
    columns?: ColumnDef<T>[];
    tenantId: string;

    // View Config (from useEntityView)
    config: EntityViewConfig<T>;

    // Actions
    onRowClick?: (item: T) => void;
    onRowDoubleClick?: (item: T) => void;
    onSelectionChange?: (selectedItems: T[]) => void;

    // Toolbar Actions
    customActions?: ReactNode;
    enableExport?: boolean;
    enableImport?: boolean;
    enableBulkActions?: boolean;
    onBulkDelete?: (ids: string[]) => Promise<void>;
    onExport?: () => void;
    onDebugSql?: () => void;

    // View Options
    availableViewModes?: ViewMode[];
    defaultViewMode?: ViewMode;

    // Render Functions (override defaults)
    renderGrid?: (props: GridRenderProps<T>) => ReactNode;
    renderCards?: (props: CardsRenderProps<T>) => ReactNode;
    renderTags?: (props: TagsRenderProps<T>) => ReactNode;
    renderTree?: (props: TreeRenderProps<T>) => ReactNode;

    // Available Filters (for AddFilterCommand)
    availableFilters?: { id: string; label: string; icon: any }[];
    filterOptions?: Record<string, any[]>;

    // Saved Views
    savedViews?: SavedView[];

    // Search History
    searchHistory?: string[];
    onAddHistory?: (term: string) => void;
    onClearHistory?: () => void;
    maxHistoryItems?: number;

    // Customization
    className?: string;
}

// ==================== Hook Options (Generic) ====================

export interface UseEntityViewOptions<T> {
    entityType: string;
    initialData?: T[];
    initialViewMode?: ViewMode;
    initialPageSize?: number;
    serverSide?: boolean;
    onFetchData?: (params: FetchDataParams) => Promise<FetchDataResult<T>>;
    getItemId?: (item: T) => string;
    debounceMs?: number;
    // Custom search filter - if provided, overrides default Object.values() search
    searchFilter?: (item: T, searchTerm: string) => boolean;
}

export interface FetchDataParams {
    filters: FilterCondition[];
    searchQuery: string;
    sorting: SortConfig[];
    pagination: PaginationConfig;
}

export interface FetchDataResult<T> {
    data: T[];
    totalRecords: number;
    totalPages: number;
}
