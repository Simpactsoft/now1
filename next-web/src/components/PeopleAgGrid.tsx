"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    GridReadyEvent,
    CellValueChangedEvent,
    ICellRendererParams,
    ValueFormatterParams,
    GetRowIdParams
} from "ag-grid-community";
// CSS Imports handled by lib/ag-grid-registry.ts globally
// import "ag-grid-community/styles/ag-grid.css";
// import "ag-grid-community/styles/ag-theme-alpine.css";
// Note: In v35 the styles might be different or all-in-one, but assuming standard imports work or are handled globally 
// effectively if included in globals.css. If not, these might be needed.
// Actually layout.tsx imports globals.css, and registry might handle modules.
// Let's assume standard setup or that these imports are harmless duplicates if already globally present.

import { StatusBadge } from "./StatusBadge";
import { updatePerson } from "@/app/actions/updatePerson";
import { useLanguage } from "@/context/LanguageContext";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

interface PeopleAgGridProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onPersonClick: (id: string, event: any) => void;
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
    statusOptions
}: PeopleAgGridProps) {
    const { language } = useLanguage();
    const { theme } = useTheme(); // Get current theme
    const gridRef = useRef<AgGridReact>(null);

    // Dynamic Theme Class
    const themeClass = theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

    // Status Options State
    // const [statusOptions, setStatusOptions] = useState<any[]>([]); // Removed internal state

    // Fetch Status Options - Removed, passed via props
    /*
    useEffect(() => {
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options", err));
    }, [tenantId]);
    */

    // Update Handler
    const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
        if (event.newValue === event.oldValue) return;

        const data = event.data;
        const field = event.colDef.field;
        const id = data.id || data.ret_id;

        console.log(`[PeopleAgGrid] Updating ${field} for ${id} to:`, event.newValue);

        const payload: any = {
            id,
            tenantId,
        };

        const val = (event.newValue || "").trim();

        if (field === 'display_name' || field === 'ret_name') {
            const parts = val.split(' ');
            payload.firstName = parts[0];
            payload.lastName = parts.slice(1).join(' ') || "";
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
            const res = await updatePerson(payload);
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
                                onPersonClick(id, e);
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
                // Force string/text type to avoid object inference warnings if data is mixed
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
                cellDataType: 'text', // Force text type to avoid object inference
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
                valueParser: (params) => params.newValue, // Allow empty
                cellDataType: 'text'
            },
            {
                field: "email", // Need to ensure data has email (might be in contact_methods)
                headerName: "Email",
                flex: 1.5,
                editable: true,
                hide: true, // Hidden by default to save space, user can enable? Or show?
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
        filter: true,
        resizable: true,
        suppressMovable: true // Simplify UX
    }), []);

    // Load More on Scroll
    const onBodyScroll = useCallback((event: any) => {
        const api = event.api;
        // api.getModel() sometimes causes issues if model not ready, use getDisplayedRowCount
        const rowCount = api.getDisplayedRowCount();
        if (rowCount === 0) return;

        const lastDisplayedRow = api.getLastDisplayedRow();
        if (lastDisplayedRow >= rowCount - 5 && hasMore && !loading) {
            loadMore();
        }
    }, [hasMore, loading, loadMore]);


    return (
        <div className={`w-full h-[600px] ${themeClass} border border-border rounded-xl overflow-hidden shadow-sm bg-card`}>
            <AgGridReact
                ref={gridRef}
                rowData={people}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                getRowId={(params: GetRowIdParams) => params.data.id || params.data.ret_id}
                onCellValueChanged={onCellValueChanged}
                onBodyScroll={onBodyScroll}
                rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
            />
            {loading && (
                <div className="absolute bottom-4 right-4 bg-background/80 p-2 rounded-full shadow-lg border border-border animate-pulse z-10">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
            )}
        </div>
    );
}
