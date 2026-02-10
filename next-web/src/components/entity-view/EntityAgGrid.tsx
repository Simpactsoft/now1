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
} from "ag-grid-community";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ColumnDef, GridRenderProps, PaginationConfig } from "./types";

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
        rowSelection = { mode: 'singleRow' as const, enableClickSelection: false },
        onCellValueChanged,
        onBodyScroll,
        onGridReady: onGridReadyProp,
        className,
        masterDetail,
        detailCellRenderer,
        detailRowHeight,
        showPagination = true,
    } = props;

    console.log('[EntityAgGrid] Received data:', data?.length, 'items');

    const { theme } = useTheme();
    const gridRef = useRef<AgGridReact>(null);
    const themeClass = theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';
    const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

    // ---- Map our ColumnDef<T> to ag-grid ColDef ----
    const columnDefs: ColDef[] = useMemo(() => {
        return columns.map((col) => ({
            field: String(col.field),
            headerName: col.headerName,
            width: col.width,
            minWidth: col.minWidth || 100,
            maxWidth: col.maxWidth,
            flex: col.flex,
            sortable: col.sortable !== false,
            filter: col.filterable !== false,
            resizable: col.resizable !== false,
            editable: col.editable,
            hide: col.hide,
            pinned: col.pinned,
            checkboxSelection: col.checkboxSelection,
            headerCheckboxSelection: col.checkboxSelection,
            cellRenderer: col.cellRenderer,
            valueGetter: col.valueGetter ? (params: any) => col.valueGetter!(params.data) : undefined,
            valueFormatter: col.valueFormatter ? (params: any) => col.valueFormatter!(params.value) : undefined,
            headerClass: col.headerClass,
            cellClass: col.cellClass as any,
            cellDataType: col.cellDataType,
        }));
    }, [columns]);

    // ---- Default col def ----
    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true,
    }), []);

    // ---- Grid Ready ----
    const onGridReady = useCallback((params: GridReadyEvent) => {
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
        const selectedRows = event.api.getSelectedRows();
        const ids = selectedRows.map((row: any) => getRowId(row));
        onSelectionChange(ids);
    }, [getRowId, onSelectionChange]);

    // ---- Sort ----
    const handleSortChanged = useCallback((event: any) => {
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
                `${themeClass} border border-border rounded-xl overflow-hidden shadow-sm bg-card relative flex-1 min-h-0`,
                hasPagination ? 'rounded-b-none border-b-0' : ''
            )}>
                <div className="w-full h-full relative">
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
                        theme="legacy"
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
                />
            )}
        </div>
    );
}

// ==================== Pagination Bar Component ====================

function PaginationBar({
    pagination,
    onPaginationChange,
}: {
    pagination: PaginationConfig;
    onPaginationChange: (pagination: Partial<PaginationConfig>) => void;
}) {
    const { page, totalPages = 1, totalRecords } = pagination;

    return (
        <div className="flex items-center justify-between px-4 py-2 border border-border rounded-b-xl bg-card/80 backdrop-blur-sm">
            <div className="text-xs text-muted-foreground">
                {totalRecords != null && (
                    <span>{totalRecords.toLocaleString('he-IL')} רשומות</span>
                )}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPaginationChange({ page: 1 })}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="ראשון"
                >
                    <ChevronsRight className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onPaginationChange({ page: page - 1 })}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="קודם"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                <span className="px-3 text-sm font-medium text-foreground">
                    {page} / {totalPages}
                </span>

                <button
                    onClick={() => onPaginationChange({ page: page + 1 })}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="הבא"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onPaginationChange({ page: totalPages })}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="אחרון"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ==================== Export with React.memo ====================

export const EntityAgGrid = React.memo(EntityAgGridInner) as typeof EntityAgGridInner;
