// EntityAgGrid.tsx — Generic AG Grid wrapper with React.memo + custom pagination
// Compatible with our existing AG Grid quartz theme and Tailwind styling.

"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    GridReadyEvent,
    GetRowIdParams,
    RowSelectionOptions,
    themeQuartz,
} from "ag-grid-community";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ColumnDef, GridRenderProps, PaginationConfig } from "./types";
import { useLanguage } from "@/context/LanguageContext";

// ==================== Props ====================

interface EntityAgGridProps<T> extends GridRenderProps<T> {
    getRowId?: (data: T) => string;
    rowHeight?: number;
    headerHeight?: number;
    enableCellTextSelection?: boolean;
    suppressRowClickSelection?: boolean;
    rowSelection?: RowSelectionOptions | "single" | "multiple";
    onCellValueChanged?: (event: any) => void;
    onBodyScroll?: (event: any) => void;
    onGridReady?: (event: GridReadyEvent) => void;
    className?: string;
    masterDetail?: boolean;
    detailCellRenderer?: (params: any) => React.ReactNode;
    detailRowHeight?: number;
    showPagination?: boolean;
}

// ==================== Component ====================

function EntityAgGridInner<T = any>(props: EntityAgGridProps<T>) {
    const {
        data,
        columns,
        loading,
        selectedIds,
        sorting,
        pagination,
        onRowClick,
        onSelectionChange,
        onSortChange,
        onPaginationChange,
        getRowId = (item: any) => item.id || item.ret_id,
        rowHeight = 48,
        headerHeight,
        enableCellTextSelection = true,
        suppressRowClickSelection = false,
        rowSelection = {
            mode: 'multiRow',
            headerCheckbox: false,
            checkboxes: false,
            enableClickSelection: false
        },
        onCellValueChanged,
        onBodyScroll,
        onGridReady: onGridReadyProp,
        className,
        masterDetail,
        detailCellRenderer,
        detailRowHeight,
        showPagination = true,
    } = props;

    const { theme } = useTheme();
    const { t, dir } = useLanguage();
    const gridRef = useRef<AgGridReact>(null);
    const gridTheme = useMemo(() => themeQuartz.withParams({ accentColor: '#6366f1' }), []);
    const isRtl = dir === 'rtl';

    // ---- Map our ColumnDef<T> to ag-grid ColDef ----
    const columnDefs: ColDef[] = useMemo(() => {
        return columns.map((col) => {
            const isSelection = col.field === 'selection' || col.checkboxSelection;
            return {
                field: String(col.field),
                headerName: col.headerName,
                width: col.width,
                minWidth: col.minWidth || 100,
                maxWidth: col.maxWidth,
                flex: col.flex,
                sortable: col.sortable === true,
                filter: col.filterable === true,
                resizable: col.resizable !== false,
                editable: col.editable,
                hide: col.hide,
                pinned: col.pinned,
                // Keep these for rendering checkboxes in the specific column
                checkboxSelection: col.checkboxSelection,
                headerCheckboxSelection: col.headerCheckboxSelection ?? col.checkboxSelection,
                cellRenderer: col.cellRenderer,
                valueGetter: col.valueGetter ? (params: any) => col.valueGetter!(params.data) : undefined,
                valueFormatter: col.valueFormatter ? (params: any) => col.valueFormatter!(params.value) : undefined,
                headerClass: col.headerClass,
                cellClass: cn(
                    "!flex items-center",
                    isSelection && "justify-center",
                    col.cellClass
                ),
                cellDataType: col.cellDataType,
            };
        });
    }, [columns]);

    // ---- Default col def ----
    // CRITICAL: filter must be false in AG Grid v32 to prevent initialization crashes
    // See: AG Grid v32 regression with "new" column menu
    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: false,
        filter: false,
        resizable: true,
        suppressMovable: true,
        cellClass: "!flex items-center",
    }), []);

    // ---- Grid Ready ----
    const onGridReady = useCallback((params: GridReadyEvent) => {
        // API Guardrail: Check if grid still exists before calling API methods
        if (!params.api || (params.api as any).destroyCalled) {
            console.warn('[EntityAgGrid] Grid API is destroyed, skipping setup');
            return;
        }

        if (sorting.length > 0) {
            const sortModel = sorting.map((s) => ({
                colId: String(s.colId),
                sort: s.sort as 'asc' | 'desc',
            }));
            params.api.applyColumnState({ state: sortModel });
        }
        onGridReadyProp?.(params);
    }, [sorting, onGridReadyProp]);

    // ---- Selection ----
    const handleSelectionChanged = useCallback((event: any) => {
        // API Guardrail: Prevent "destroyed grid" errors
        if (!event.api || (event.api as any).destroyCalled) {
            console.warn('[EntityAgGrid] Grid destroyed during selection change');
            return;
        }
        const selectedRows = event.api.getSelectedRows();
        const ids = selectedRows.map((row: any) => getRowId(row));
        onSelectionChange(ids);
    }, [getRowId, onSelectionChange]);

    // ---- Sort ----
    const handleSortChanged = useCallback((event: any) => {
        // API Guardrail: Prevent stale API calls
        if (!event.api || (event.api as any).destroyCalled) {
            console.warn('[EntityAgGrid] Grid destroyed during sort change');
            return;
        }
        const sortModel = event.api.getColumnState()
            .filter((col: any) => col.sort)
            .map((col: any) => ({
                colId: col.colId,
                sort: col.sort as 'asc' | 'desc',
            }));
        onSortChange(sortModel);
    }, [onSortChange]);

    // ---- Row Click ----
    const handleRowClicked = useCallback((event: any) => {
        if (onRowClick && !suppressRowClickSelection) {
            onRowClick(event.data);
        }
    }, [onRowClick, suppressRowClickSelection]);

    // ---- Pagination helpers ----
    const hasPagination = showPagination && pagination.totalPages && pagination.totalPages > 1;

    return (
        <div className={cn("flex flex-col w-full h-full", className)}>
            {/* AG Grid */}
            <div className={cn(
                "border border-border rounded-xl overflow-hidden shadow-sm bg-card relative flex-1 min-h-[500px]",
                hasPagination ? 'rounded-b-none border-b-0' : ''
            )}>
                <div className="absolute inset-0">
                    <AgGridReact
                        ref={gridRef}
                        rowData={data}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        getRowId={(params: GetRowIdParams) => getRowId(params.data)}
                        pagination={false}
                        rowSelection={rowSelection}
                        suppressDragLeaveHidesColumns={true}
                        rowHeight={rowHeight}
                        headerHeight={headerHeight}
                        enableCellTextSelection={enableCellTextSelection}
                        onGridReady={onGridReady}
                        onSelectionChanged={handleSelectionChanged}
                        onSortChanged={handleSortChanged}
                        onRowClicked={handleRowClicked}
                        onCellValueChanged={onCellValueChanged}
                        onBodyScroll={onBodyScroll}
                        masterDetail={masterDetail}
                        detailCellRenderer={detailCellRenderer}
                        detailRowHeight={detailRowHeight}
                        enableRtl={isRtl}
                        theme={gridTheme}
                    />

                    {loading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Pagination Controls */}
            {hasPagination && (
                <PaginationBar
                    pagination={pagination}
                    onPaginationChange={onPaginationChange}
                    t={t}
                    dir={dir}
                />
            )}
        </div>
    );
}

// ==================== Pagination Bar Component ====================

function PaginationBar({
    pagination,
    onPaginationChange,
    t,
    dir,
}: {
    pagination: PaginationConfig;
    onPaginationChange: (pagination: Partial<PaginationConfig>) => void;
    t: any;
    dir: string;
}) {
    const { page, totalPages = 1, totalRecords } = pagination;

    return (
        <div className="flex items-center justify-between px-4 py-2 border border-border rounded-b-xl bg-card/80 backdrop-blur-sm">
            <div className="text-xs text-muted-foreground">
                {totalRecords != null && (
                    <span>{totalRecords.toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US')} {t('found')}</span>
                )}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPaginationChange({ page: 1 })}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('first')}
                >
                    {dir === 'rtl' ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                </button>
                <button
                    onClick={() => onPaginationChange({ page: page - 1 })}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('prev')}
                >
                    {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <span className="px-3 text-sm font-medium text-foreground">
                    {page} / {totalPages}
                </span>

                <button
                    onClick={() => onPaginationChange({ page: page + 1 })}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('next')}
                >
                    {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <button
                    onClick={() => onPaginationChange({ page: totalPages })}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('last')}
                >
                    {dir === 'rtl' ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

// ==================== Export with React.memo ====================

export const EntityAgGrid = React.memo(EntityAgGridInner) as typeof EntityAgGridInner;
