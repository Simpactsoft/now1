"use client";

import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    GridReadyEvent,
    IDetailCellRendererParams,
    GetRowIdParams,
    RowSelectionOptions,
    themeQuartz,
} from "ag-grid-community";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// CSS Imports handled globally by lib/ag-grid-registry.ts

interface EntityAgGridProps {
    rowData: any[];
    columnDefs: ColDef[];
    loading?: boolean;
    onRowClick?: (id: string, data: any, event: any) => void;
    onGridReady?: (event: GridReadyEvent) => void;
    getRowId?: (params: GetRowIdParams) => string;
    className?: string;
    pagination?: boolean;
    paginationPageSize?: number;
    rowSelection?: RowSelectionOptions | "single" | "multiple";
    suppressDragLeaveHidesColumns?: boolean;
    onCellValueChanged?: (event: any) => void;
    onBodyScroll?: (event: any) => void;
    overlayLoadingTemplate?: string;
    overlayNoRowsTemplate?: string;
    detailCellRenderer?: (params: IDetailCellRendererParams) => React.ReactNode;
    masterDetail?: boolean;
    detailRowHeight?: number;
}

export default function EntityAgGrid({
    rowData,
    columnDefs,
    loading = false,
    onRowClick,
    onGridReady,
    getRowId,
    className,
    pagination = true,
    paginationPageSize = 20,
    rowSelection = { mode: 'singleRow', enableClickSelection: false },
    suppressDragLeaveHidesColumns = true,
    onCellValueChanged,
    onBodyScroll,
    overlayLoadingTemplate,
    overlayNoRowsTemplate,
    detailCellRenderer,
    masterDetail,
    detailRowHeight
}: EntityAgGridProps) {
    const { theme } = useTheme();
    const gridRef = useRef<AgGridReact>(null);
    const gridTheme = themeQuartz.withParams({ accentColor: '#6366f1' });
    const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

    // Default Column Definitions
    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: false,
        resizable: true,
        suppressMovable: true,
    }), []);

    // Default GetRowId if not provided
    const defaultGetRowId = (params: GetRowIdParams) => params.data.id || params.data.ret_id;

    return (
        <div className={cn("w-full h-full border border-border rounded-xl overflow-hidden shadow-sm bg-card relative", className)}>
            <div className="absolute inset-0">
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    getRowId={getRowId || defaultGetRowId}
                    pagination={pagination}
                    paginationPageSize={paginationPageSize}
                    rowSelection={rowSelection}
                    suppressDragLeaveHidesColumns={suppressDragLeaveHidesColumns}
                    onGridReady={onGridReady}
                    onCellValueChanged={onCellValueChanged}
                    onCellClicked={(event) => {
                        if (onRowClick && event.data) {
                            onRowClick(event.data.id || event.data.ret_id, event.data, event);
                        }
                    }}
                    onBodyScroll={onBodyScroll}
                    overlayLoadingTemplate={overlayLoadingTemplate}
                    overlayNoRowsTemplate={overlayNoRowsTemplate}
                    // Master Detail
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
    );
}
