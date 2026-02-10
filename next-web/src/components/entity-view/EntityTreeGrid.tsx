// EntityTreeGrid.tsx — Generic Tree Grid wrapper using AG Grid Tree Data feature
// Supports hierarchical data with expand/collapse, lazy loading, and custom grouping

"use client";

import React, { useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import type { GridReadyEvent, ColDef } from "ag-grid-community";
import { themeQuartz } from 'ag-grid-community';
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ColumnDef, TreeRenderProps } from "./types";

// ==================== Props ====================

interface EntityTreeGridProps<T> extends TreeRenderProps<T> {
    columns?: ColumnDef<T>[];
    getRowId?: (data: T) => string;
    rowHeight?: number;
    headerHeight?: number;
    onGridReady?: (event: GridReadyEvent) => void;
    className?: string;
}

// ==================== Component ====================

function EntityTreeGridInner<T = any>(props: EntityTreeGridProps<T>) {
    const {
        data,
        columns = [],
        loading,
        selectedIds,
        onRowClick,
        onSelectionChange,
        getDataPath,
        autoGroupColumnDef,
        getRowId = (data: any) => data.id,
        rowHeight = 48,
        headerHeight = 44,
        onGridReady,
        className = "",
    } = props;

    console.log('EntityTreeGrid received data:', data?.length, 'items', data);

    // Convert ColumnDef to AG Grid ColDef
    const columnDefs = useMemo<ColDef[]>(() => {
        return columns.map((col) => ({
            field: col.field as string,
            headerName: col.headerName,
            width: col.width,
            minWidth: col.minWidth || 100,
            maxWidth: col.maxWidth,
            flex: col.flex,
            sortable: col.sortable ?? true,
            resizable: col.resizable ?? true,
            editable: col.editable ?? false,
            hide: col.hide ?? false,
            pinned: col.pinned,
            checkboxSelection: col.checkboxSelection ?? false,
            cellRenderer: col.cellRenderer ? (params: any) => col.cellRenderer!({ value: params.value, data: params.data }) : undefined,
            valueGetter: col.valueGetter ? (params: any) => col.valueGetter!(params.data) : undefined,
            valueFormatter: col.valueFormatter ? (params: any) => col.valueFormatter!(params.value) : undefined,
            headerClass: col.headerClass,
            cellClass: col.cellClass,
            cellDataType: col.cellDataType,
        }));
    }, [columns]);

    // Auto Group Column Definition
    const defaultAutoGroupColumnDef = useMemo<ColDef>(() => ({
        headerName: 'Hierarchy',
        minWidth: 300,
        cellRendererParams: {
            suppressCount: false,
        },
        ...autoGroupColumnDef,
    }), [autoGroupColumnDef]);

    // Default Column Definition
    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        resizable: true,
        filter: false,
        minWidth: 100,
    }), []);

    // Row Selection
    const rowSelection = useMemo(() => ({
        mode: 'multiRow' as const,
        checkboxes: true,
        headerCheckbox: true,
    }), []);

    // Handle row selection change
    const onSelectionChanged = useCallback((event: any) => {
        const selectedNodes = event.api.getSelectedNodes();
        const selectedData = selectedNodes.map((node: any) => node.data);
        const ids = selectedData.map((item: any) => getRowId(item)).filter(Boolean);
        onSelectionChange(ids);
    }, [onSelectionChange, getRowId]);

    // Handle row click
    const onRowClicked = useCallback((event: any) => {
        if (onRowClick && event.data) {
            onRowClick(event.data);
        }
    }, [onRowClick]);

    // Grid Ready Handler
    const handleGridReady = useCallback((event: GridReadyEvent) => {
        // Pre-select rows based on selectedIds
        if (selectedIds.length > 0 && event.api) {
            event.api.forEachNode((node) => {
                if (node.data) {
                    const id = getRowId(node.data);
                    if (selectedIds.includes(id)) {
                        node.setSelected(true);
                    }
                }
            });
        }

        if (onGridReady) {
            onGridReady(event);
        }
    }, [selectedIds, getRowId, onGridReady]);

    if (loading && data.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading tree data...</span>
            </div>
        );
    }

    if (!loading && data.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No data to display</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex-1 ag-theme-quartz">
                <AgGridReact
                    theme={themeQuartz}
                    rowData={data}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    autoGroupColumnDef={defaultAutoGroupColumnDef}
                    treeData={true}
                    getDataPath={getDataPath}
                    getRowId={(params) => getRowId(params.data)}
                    rowSelection={rowSelection}
                    onSelectionChanged={onSelectionChanged}
                    onRowClicked={onRowClicked}
                    onGridReady={handleGridReady}
                    rowHeight={rowHeight}
                    headerHeight={headerHeight}
                    animateRows={true}
                    enableCellTextSelection={true}
                    suppressRowClickSelection={true}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
}

// ==================== Export with React.memo ====================

export const EntityTreeGrid = React.memo(EntityTreeGridInner) as typeof EntityTreeGridInner;
