"use client";

import { useMemo, useCallback } from "react";
import {
    ColDef,
    CellValueChangedEvent,
    ICellRendererParams,
    ValueFormatterParams,
    GetRowIdParams
} from "ag-grid-community";
// CSS Imports handled by lib/ag-grid-registry.ts globally

import { StatusBadge } from "./StatusBadge";
import { updateOrganization } from "@/app/actions/updateOrganization";
import { updatePerson } from "@/app/actions/updatePerson";
import { useLanguage } from "@/context/LanguageContext";
import EntityAgGrid from "@/components/EntityAgGrid";

interface PeopleAgGridProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onPersonClick: (id: string, type?: string, event?: any) => void;
    highlightId: string | null;
    tenantId: string;
    statusOptions: any[];
}

export default function PeopleAgGrid({
    people,
    loading,
    hasMore,
    loadMore,
    onPersonClick,
    highlightId,
    tenantId,
    statusOptions,
    className
}: PeopleAgGridProps & { className?: string }) {
    const { language } = useLanguage();

    // Update Handler

    // Update Handler
    const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
        if (event.newValue === event.oldValue) return;

        const data = event.data;
        const field = event.colDef.field;
        const id = data.id || data.ret_id;
        const type = data.type || data.ret_type; // 'person' or 'organization'

        console.log(`[PeopleAgGrid] Updating ${field} for ${id} (${type}) to:`, event.newValue);

        const payload: any = {
            id,
            tenantId,
        };

        const val = (event.newValue || "").trim();

        if (field === 'display_name' || field === 'ret_name') {
            if (type === 'organization') {
                payload.displayName = val;
            } else {
                const parts = val.split(' ');
                payload.firstName = parts[0];
                payload.lastName = parts.slice(1).join(' ') || "";
            }
        } else if (field === 'ret_status') {
            payload.customFields = { status: val };
        } else if (field === 'ret_role_name') {
            payload.role = val;
        } else if (field === 'email') {
            payload.email = val;
        } else if (field === 'phone') {
            payload.phone = val;
        }

        try {
            let res;
            if (type === 'organization') {
                res = await updateOrganization(payload);
            } else {
                res = await updatePerson(payload);
            }

            if (!res.success) {
                console.error("Update failed:", res.error);
                // Ideally revert here
            } else {
                console.log("Update success");
            }
        } catch (e) {
            console.error("Update Error", e);
        }

    }, [tenantId]);


    // Column Definitions
    const columnDefs = useMemo<ColDef[]>(() => {

        // Helper to format status value to label
        const statusValueFormatter = (params: ValueFormatterParams) => {
            const val = params.value;
            if (!val) return "";
            const opt = statusOptions.find((o: any) => o.value === val);
            return opt ? (opt.payload?.label_i18n?.[language] || opt.label || val) : val;
        };

        return [
            {
                headerName: "",
                width: 50,
                pinned: 'left',
                sortable: false,
                filter: false,
                cellRenderer: (params: ICellRendererParams) => {
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const id = params.data.id || params.data.ret_id;
                                const type = params.data.type || params.data.ret_type;
                                onPersonClick(id, type, e);
                            }}
                            className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors opacity-50 hover:opacity-100"
                            title="View Profile"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                        </button>
                    );
                }
            },
            {
                headerName: "#",
                valueGetter: "node.rowIndex + 1",
                width: 60,
                pinned: 'left',
                sortable: false,
                filter: false,
                cellDataType: 'text'
            },
            {
                field: "ret_name", // or display_name
                headerName: language === 'he' ? "שם" : "Name",
                flex: 2,
                editable: true,
                minWidth: 150,
                cellDataType: 'text',
                cellRenderer: (params: ICellRendererParams) => {
                    const name = params.value || "Unknown";
                    const initials = name.substring(0, 2).toUpperCase();
                    return (
                        <div className="flex items-center gap-2 h-full">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                                {initials}
                            </div>
                            <span>{name}</span>
                        </div>
                    );
                }
            },
            {
                field: "ret_status",
                headerName: language === 'he' ? "סטטוס" : "Status",
                width: 140,
                editable: true,
                cellDataType: 'text',
                cellRenderer: (params: ICellRendererParams) => {
                    if (!params.value) return <span className="opacity-50">-</span>;
                    return <StatusBadge status={params.value} tenantId={tenantId} />;
                },
                cellEditor: 'agRichSelectCellEditor',
                cellEditorParams: {
                    values: statusOptions.map(o => o.value),
                    cellRenderer: (params: ICellRendererParams) => {
                        if (!params.value) return "";
                        const opt = statusOptions.find((o: any) => o.value === params.value);
                        const label = opt ? (opt.payload?.label_i18n?.[language] || opt.label || params.value) : params.value;
                        return label;
                    }
                },
                valueFormatter: statusValueFormatter
            },
            {
                field: "ret_role_name",
                headerName: language === 'he' ? "תפקיד" : "Role",
                flex: 1.5,
                editable: true,
                valueParser: (params: any) => params.newValue,
                cellDataType: 'text'
            },
            {
                field: "email",
                headerName: "Email",
                flex: 1.5,
                editable: true,
                hide: true,
                cellDataType: 'text'
            },
            {
                field: "phone",
                headerName: "Phone",
                flex: 1.5,
                editable: true,
                hide: true,
                cellDataType: 'text'
            },
            {
                field: "ret_tags",
                headerName: language === 'he' ? "תגיות" : "Tags",
                flex: 2,
                editable: false,
                cellRenderer: (params: ICellRendererParams) => {
                    const tags = params.value || [];
                    if (!tags.length) return "";
                    return (
                        <div className="flex flex-wrap gap-1 items-center h-full">
                            {tags.slice(0, 2).map((tag: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-secondary rounded text-[10px] text-muted-foreground border border-border/50">
                                    {tag}
                                </span>
                            ))}
                            {tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>}
                        </div>
                    );
                }
            },
            {
                field: "ret_last_interaction",
                headerName: language === 'he' ? "פעילות אחרונה" : "Last Active",
                width: 120,
                editable: false,
                valueFormatter: (params: ValueFormatterParams) => {
                    if (!params.value) return "-";
                    return new Date(params.value).toLocaleDateString();
                }
            }
        ];
    }, [language, statusOptions, tenantId]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: false,
        resizable: true,
        suppressMovable: true
    }), []);

    // Load More on Scroll
    const onBodyScroll = useCallback((event: any) => {
        const api = event.api;
        const rowCount = api.getDisplayedRowCount();
        if (rowCount === 0) return;

        const lastDisplayedRow = api.getLastDisplayedRow();
        if (lastDisplayedRow >= rowCount - 5 && hasMore && !loading) {
            loadMore();
        }
    }, [hasMore, loading, loadMore]);


    return (
        <EntityAgGrid
            rowData={people}
            columnDefs={columnDefs}
            loading={loading}
            onCellValueChanged={onCellValueChanged}
            onBodyScroll={onBodyScroll}
            getRowId={(params: GetRowIdParams) => params.data.id || params.data.ret_id}
            className={className}
        />
    );
}
