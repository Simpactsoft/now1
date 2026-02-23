"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";

import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    GridReadyEvent,
    IServerSideDatasource,
    IServerSideGetRowsParams,
    themeQuartz,
} from "ag-grid-community";
import { fetchGridData } from "@/app/actions/fetchEmployees";

interface EmployeesGridProps {
    tenantId: string;
    onDataFetch?: (latency: number, totalRows: number) => void;
}

export default function EmployeesGrid({
    tenantId,
    onDataFetch,
}: EmployeesGridProps) {
    const gridRef = useRef<AgGridReact>(null);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: "ret_id", headerName: "ID", minWidth: 200 },
            { field: "ret_name", headerName: "Name", filter: "agTextColumnFilter", sortable: true },
            {
                field: "ret_salary",
                headerName: "Salary",
                filter: "agNumberColumnFilter",
                sortable: true,
                valueFormatter: (params) => {
                    if (params.value == null) return "-";
                    return new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                    }).format(params.value);
                },
            },
            { field: "ret_org_path", headerName: "Org Path", filter: "agTextColumnFilter" },
            {
                field: "ret_created_at",
                headerName: "Created At",
                filter: "agDateColumnFilter",
                sortable: true,
            },
        ],
        []
    );

    const [error, setError] = useState<string | null>(null);

    const datasource = useMemo<IServerSideDatasource>(() => {
        return {
            getRows: async (params: IServerSideGetRowsParams) => {
                setError(null);
                console.log("AG Grid requesting rows:", params.request.startRow, params.request.endRow);

                const result = await fetchGridData({
                    startRow: params.request.startRow ?? 0,
                    endRow: params.request.endRow ?? 100,
                    sortModel: params.request.sortModel,
                    filterModel: (params.request.filterModel as Record<string, any>) || {},
                    tenantId,
                });

                if (result.error) {
                    console.error("Grid datasource error:", result.error);
                    setError(result.error);
                    params.fail();
                    return;
                }

                params.success({
                    rowData: result.rowData,
                    rowCount: result.rowCount,
                });

                if (onDataFetch) {
                    onDataFetch(result.latency, result.rowCount);
                }
            },
        };
    }, [tenantId, onDataFetch]);


    // Purge cache when tenant changes
    useEffect(() => {
        if (gridRef.current?.api) {
            gridRef.current.api.refreshServerSide({ purge: true });
        }
    }, [tenantId]);

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-center text-xs text-zinc-500 font-mono px-2">
                <span>Row Model: Server-Side Row Model (SSRM)</span>
                {error && <span className="text-red-500 font-bold">Error: {error}</span>}
            </div>
            <div className="w-full h-[600px] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                <AgGridReact
                    theme={themeQuartz}
                    ref={gridRef}
                    columnDefs={columnDefs}
                    rowModelType="serverSide"
                    serverSideDatasource={datasource}
                    cacheBlockSize={100}
                    maxBlocksInCache={10}
                    animateRows={true}
                    pagination={false}
                    enableRtl={typeof document !== 'undefined' && document.documentElement.dir === 'rtl'}
                />
            </div>
        </div>

    );
}
