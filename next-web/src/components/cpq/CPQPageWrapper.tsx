"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Sliders, Package, Settings } from "lucide-react";
import { ColumnDef } from "@/components/entity-view";
import { getTemplates, deleteTemplates } from "@/app/actions/cpq/template-actions";
import CPQTemplateTags from "@/components/cpq/CPQTemplateTags";
import NewTemplateDropdown from "@/components/cpq/NewTemplateDropdown";

interface CPQTemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
}

interface CPQPageWrapperProps {
    tenantId: string | null;
}

export default function CPQPageWrapper({ tenantId }: CPQPageWrapperProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Removed saved configurations tab - feature postponed

    // ---- Column Definitions ----
    const columns: ColumnDef[] = useMemo(() => [
        {
            field: 'name',
            headerName: 'Template Name',
            minWidth: 250,
            sortable: true,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 py-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    <span className="font-medium">{params.value}</span>
                </div>
            )
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            sortable: false,
            cellRenderer: (params: any) => (
                <span className="text-muted-foreground text-sm">
                    {params.value || 'No description'}
                </span>
            )
        },
        {
            field: 'category',
            headerName: 'Category',
            width: 150,
            sortable: true,
            cellRenderer: (params: any) => params.value ? (
                <span className="px-2 py-1 bg-secondary rounded-full text-xs">
                    {params.value}
                </span>
            ) : null
        },
        {
            field: 'updatedAt',
            headerName: 'Last Modified',
            width: 180,
            sortable: true,
            cellRenderer: (params: any) => {
                if (!params.value) return null;
                return (
                    <span className="text-xs text-muted-foreground">
                        {new Date(params.value).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                );
            }
        },
        {
            field: 'id',
            headerName: 'Actions',
            width: 180,
            sortable: false,
            cellRenderer: (params: any) => (
                <div className="flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/cpq/${params.value}/edit`);
                        }}
                        className="px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors flex items-center gap-1"
                    >
                        <Settings className="w-3 h-3" />
                        Edit
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/configurator/${params.value}`);
                        }}
                        className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors flex items-center gap-1"
                    >
                        <Package className="w-3 h-3" />
                        Preview
                    </button>
                </div>
            )
        }
    ], [router]);


    // ---- Server-Side Data Fetching ----
    const onFetchData = useCallback(async (params: FetchDataParams): Promise<FetchDataResult<CPQTemplate>> => {
        console.log('[CPQPageWrapper] onFetchData called with:', { tenantId, params });

        try {
            const result = await getTemplates({
                search: params.searchQuery,
                page: params.pagination?.page || 1,
                pageSize: params.pagination?.pageSize || 50,
            });

            console.log('[CPQPageWrapper] getTemplates result:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch templates');
            }

            return {
                data: (result.data as unknown as CPQTemplate[]) || [],
                totalRecords: result.meta?.total || 0,
                totalPages: result.meta?.page || 0
            };
        } catch (e: any) {
            console.error('[CPQPageWrapper] Fetch error:', e);
            toast.error(e.message);
            return { data: [], totalRecords: 0, totalPages: 0 };
        }
    }, [tenantId]);

    const config = useEntityView<CPQTemplate>({
        entityType: 'cpq_templates',
        serverSide: true,
        debounceMs: 500,
        initialPageSize: 50,
        onFetchData,
        initialViewMode: 'grid',
    });

    // ---- Actions ----
    const handleTemplateClick = (template: CPQTemplate) => {
        router.push(`/dashboard/cpq/${template.id}/edit`);
    };

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        const result = await deleteTemplates(ids);
        if (result.success) {
            toast.success(`${result.deletedCount} תבנית${(result.deletedCount || 0) > 1 ? 'ות' : ''} נמחקו בהצלחה`);
        } else {
            toast.error(result.error || 'שגיאה במחיקת תבניות');
        }
    }, []);




    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Search Templates', icon: null },
        { id: 'category', label: 'Category', icon: null },
    ], []);

    return (
        <div className="h-full flex flex-col">
            {/* Header with Action Button */}
            <div className="border-b border-border bg-background sticky top-0 z-40">
                <div className="flex items-center justify-between px-6 py-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-primary" />
                        Product Templates
                    </h2>
                    <NewTemplateDropdown tenantId={tenantId} />
                </div>
            </div>

            {/* Content */}
            <EntityViewLayout
                title=""
                entityType="cpq_templates"
                tenantId={tenantId || ""}
                config={config}
                columns={columns}
                onRowClick={handleTemplateClick}
                onRowDoubleClick={handleTemplateClick}
                availableViewModes={['tags', 'grid', 'cards']}
                availableFilters={availableFilters}
                onBulkDelete={handleBulkDelete}

                // Tags View
                renderTags={(props) => (
                    <CPQTemplateTags
                        templates={props.data}
                        loading={props.loading}
                        onTemplateClick={handleTemplateClick}
                    />
                )}

                // Cards View
                renderCards={(props) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-24">
                        {props.data.map(template => (
                            <div
                                key={template.id}
                                onClick={() => handleTemplateClick(template)}
                                className="group p-6 border border-border rounded-xl hover:border-primary hover:bg-accent/50 hover:shadow-lg transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-primary/10 rounded-lg">
                                        <Sliders className="w-8 h-8 text-primary" />
                                    </div>
                                    {template.category && (
                                        <span className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground">
                                            {template.category}
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                                    {template.name}
                                </h3>

                                {template.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                        {template.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-border">
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(template.updatedAt).toLocaleDateString()}
                                    </span>
                                    <span className="text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        Configure <Settings className="w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            />
        </div>
    );
}
