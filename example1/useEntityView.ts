// useEntityView.ts - Hook מרכזי לניהול State

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ViewMode,
  FilterChip,
  SortConfig,
  PaginationConfig,
  EntityViewConfig,
  SavedView,
  SearchHistoryItem,
} from './types';

interface UseEntityViewOptions<T> {
  entityType: string;
  initialData?: T[];
  initialViewMode?: ViewMode;
  initialPageSize?: number;
  serverSide?: boolean; // האם הסינון והדף הוא server-side
  onFetchData?: (params: FetchDataParams) => Promise<FetchDataResult<T>>;
  getItemId?: (item: T) => string; // פונקציה לחילוץ ID מהאובייקט
}

interface FetchDataParams {
  filters: FilterChip[];
  searchQuery: string;
  sorting: SortConfig[];
  pagination: PaginationConfig;
}

interface FetchDataResult<T> {
  data: T[];
  totalRecords: number;
  totalPages: number;
}

export function useEntityView<T = any>(options: UseEntityViewOptions<T>): EntityViewConfig<T> {
  const {
    entityType,
    initialData = [],
    initialViewMode = 'grid',
    initialPageSize = 50,
    serverSide = false,
    onFetchData,
    getItemId = (item: any) => item.id,
  } = options;

  // ==================== State ====================
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filters, setFilters] = useState<FilterChip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortConfig[]>([]);
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: initialPageSize,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ==================== Data Fetching ====================
  const fetchData = useCallback(async () => {
    if (!serverSide || !onFetchData) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onFetchData({
        filters,
        searchQuery,
        sorting,
        pagination,
      });

      setData(result.data);
      setPagination((prev) => ({
        ...prev,
        totalRecords: result.totalRecords,
        totalPages: result.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, sorting, pagination, serverSide, onFetchData]);

  // טען נתונים כאשר הפרמטרים משתנים (רק ב-server-side)
  useEffect(() => {
    if (serverSide) {
      fetchData();
    }
  }, [fetchData, serverSide]);

  // ==================== Client-Side Filtering ====================
  const filteredData = useMemo(() => {
    if (serverSide) return data; // בserver-side הנתונים כבר מסוננים

    let result = [...data];

    // החל חיפוש
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        Object.values(item as any).some((value) =>
          String(value).toLowerCase().includes(query)
        )
      );
    }

    // החל פילטרים
    filters.forEach((filter) => {
      result = result.filter((item) => {
        const value = (item as any)[filter.field];
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'notEquals':
            return value !== filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'notContains':
            return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greaterThan':
            return value > filter.value;
          case 'lessThan':
            return value < filter.value;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          case 'isEmpty':
            return !value || value === '';
          case 'isNotEmpty':
            return !!value && value !== '';
          default:
            return true;
        }
      });
    });

    // החל מיון
    if (sorting.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorting) {
          const aVal = (a as any)[sort.field];
          const bVal = (b as any)[sort.field];
          
          if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, filters, sorting, serverSide]);

  // ==================== Pagination (Client-Side) ====================
  const paginatedData = useMemo(() => {
    if (serverSide) return filteredData; // בserver-side הנתונים כבר מחולקים לדפים

    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pagination, serverSide]);

  // עדכן totalRecords ו-totalPages (Client-Side)
  useEffect(() => {
    if (!serverSide) {
      const totalRecords = filteredData.length;
      const totalPages = Math.ceil(totalRecords / pagination.pageSize);
      
      setPagination((prev) => ({
        ...prev,
        totalRecords,
        totalPages,
      }));
    }
  }, [filteredData.length, pagination.pageSize, serverSide]);

  // ==================== Filter Actions ====================
  const addFilter = useCallback((filter: FilterChip) => {
    setFilters((prev) => [...prev, { ...filter, id: Date.now().toString() }]);
    setPagination((prev) => ({ ...prev, page: 1 })); // חזור לעמוד 1
  }, []);

  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setSearchQuery('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // ==================== Selection Actions ====================
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    const allIds = paginatedData.map(getItemId);
    setSelectedIds(allIds);
  }, [paginatedData, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // ==================== Saved Views ====================
  const saveView = useCallback(async (name: string) => {
    const view: SavedView = {
      id: Date.now().toString(),
      name,
      filters,
      sorting,
      viewMode,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // כאן תוכל לשמור ל-localStorage או לשרת
    const savedViews = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
    savedViews.push(view);
    localStorage.setItem(`savedViews_${entityType}`, JSON.stringify(savedViews));
  }, [filters, sorting, viewMode, entityType]);

  const loadView = useCallback(async (viewId: string) => {
    const savedViews = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
    const view = savedViews.find((v: SavedView) => v.id === viewId);
    
    if (view) {
      setFilters(view.filters);
      setSorting(view.sorting || []);
      setViewMode(view.viewMode);
    }
  }, [entityType]);

  const deleteView = useCallback(async (viewId: string) => {
    const savedViews = JSON.parse(localStorage.getItem(`savedViews_${entityType}`) || '[]');
    const filtered = savedViews.filter((v: SavedView) => v.id !== viewId);
    localStorage.setItem(`savedViews_${entityType}`, JSON.stringify(filtered));
  }, [entityType]);

  // ==================== Refresh ====================
  const refresh = useCallback(async () => {
    if (serverSide) {
      await fetchData();
    }
  }, [fetchData, serverSide]);

  // ==================== Return Config ====================
  return {
    // State
    viewMode,
    filters,
    searchQuery,
    sorting,
    pagination,
    selectedIds,
    data: serverSide ? data : paginatedData,
    filteredData,
    loading,
    error,

    // Actions
    setViewMode,
    addFilter,
    removeFilter,
    clearFilters,
    setSearchQuery,
    setSorting,
    setPagination,
    setSelectedIds,
    toggleSelection,
    selectAll,
    clearSelection,

    // View Management
    saveView,
    loadView,
    deleteView,

    // Refresh
    refresh,
  };
}
