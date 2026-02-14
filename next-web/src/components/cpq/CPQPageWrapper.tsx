"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Sliders, Package, Settings } from "lucide-react";
import { ColumnDef } from "@/components/entity-view";
import { getTemplates } from "@/app/actions/cpq/template-actions";
import CPQTemplateTags from "@/components/cpq/CPQTemplateTags";

interface CPQTemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    tenant_id: string;
    created_at: string;
    updated_at: string;
}

interface CPQPageWrapperProps {
    tenantId: string | null;
}

export default function CPQPageWrapper({ tenantId }: CPQPageWrapperProps) {
    const router = useRouter();

    // ---- Column Definitions ----
    const columns: ColumnDef[] = useMemo(() => [
        {
            field: 'name',
            headerName: 'Template Name',
            minWidth: 250,
            sortable: true,
            filter: true,
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
            filter: true,
            cellRenderer: (params: any) => params.value ? (
                <span className="px-2 py-1 bg-secondary rounded-full text-xs">
                    {params.value}
                </span>
            ) : null
        },
        {
            field: 'updated_at',
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
                data: result.data || [],
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
        defaultViewMode: 'grid',
    });

    // ---- Actions ----
    const handleTemplateClick = (template: CPQTemplate) => {
        router.push(`/dashboard/cpq/${template.id}/edit`);
    };


    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Search Templates', icon: null },
        { id: 'category', label: 'Category', icon: null },
    ], []);

    return (
        <EntityViewLayout
            title="CPQ Templates"
            entityType="cpq_templates"
            tenantId={tenantId}
            config={config}
            columns={columns}
            onRowClick={handleTemplateClick}
            onRowDoubleClick={handleTemplateClick}
            availableViewModes={['tags', 'grid', 'cards']}
            availableFilters={availableFilters}
            customActions={
                <button
                    onClick={() => router.push('/dashboard/cpq/new')}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Sliders className="w-4 h-4" />
                    + New Template
                </button>
            }

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
                                    {new Date(template.updated_at).toLocaleDateString()}
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
    );
}
