"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { FileText, Edit, Trash, Share2, Copy } from "lucide-react";
import { ColumnDef } from "@/components/entity-view";
import { getConfigurations, deleteConfiguration, duplicateConfiguration } from "@/app/actions/cpq/configuration-actions";

interface CPQConfiguration {
    id: string;
    template_name?: string;
    status: "draft" | "completed" | "quoted" | "ordered" | "expired";
    quantity: number;
    total_price: number;
    updated_at: string;
    template_id: string;
}

interface ConfigurationsPageWrapperProps {
    tenantId: string | null;
}

export default function ConfigurationsPageWrapper({ tenantId }: ConfigurationsPageWrapperProps) {
    const router = useRouter();

    // ---- Column Definitions ----
    const columns: ColumnDef[] = useMemo(() => [
        {
            field: 'template_name',
            headerName: 'Template',
            minWidth: 200,
            sortable: true,
            filter: true,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 py-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{params.value || 'Unknown Template'}</span>
                </div>
            )
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 130,
            sortable: true,
            filter: true,
            cellRenderer: (params: any) => {
                const statusColors = {
                    draft: 'bg-gray-100 text-gray-700',
                    completed: 'bg-blue-100 text-blue-700',
                    quoted: 'bg-purple-100 text-purple-700',
                    ordered: 'bg-green-100 text-green-700',
                    expired: 'bg-red-100 text-red-700'
                };
                const color = statusColors[params.value as keyof typeof statusColors] || statusColors.draft;

                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                        {params.value}
                    </span>
                );
            }
        },
        {
            field: 'quantity',
            headerName: 'Qty',
            width: 80,
            sortable: true,
            cellRenderer: (params: any) => (
                <span className="text-sm">{params.value}</span>
            )
        },
        {
            field: 'total_price',
            headerName: 'Total Price',
            width: 130,
            sortable: true,
            cellRenderer: (params: any) => (
                <span className="font-medium">${parseFloat(params.value || 0).toFixed(2)}</span>
            )
        },
        {
            field: 'updated_at',
            headerName: 'Last Updated',
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
            width: 150,
            sortable: false,
            cellRenderer: (params: any) => (
                <div className="flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/configurator/${params.data.template_id}?config=${params.value}`);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(params.value);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Duplicate"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(params.value);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [router]);

    // ---- Server-Side Data Fetching ----
    const onFetchData = useCallback(async (params: FetchDataParams): Promise<FetchDataResult<CPQConfiguration>> => {
        console.log('[ConfigurationsPageWrapper] onFetchData called with:', { tenantId, params });

        try {
            const result = await getConfigurations({
                page: params.pagination?.page || 1,
                pageSize: params.pagination?.pageSize || 50,
            });

            console.log('[ConfigurationsPageWrapper] getConfigurations result:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch configurations');
            }

            return {
                data: result.data || [],
                totalRecords: result.meta?.total || 0,
                totalPages: result.meta?.page || 0
            };
        } catch (e: any) {
            console.error('[ConfigurationsPageWrapper] Fetch error:', e);
            toast.error(e.message);
            return { data: [], totalRecords: 0, totalPages: 0 };
        }
    }, [tenantId]);

    const config = useEntityView<CPQConfiguration>({
        entityType: 'cpq_configurations',
        serverSide: true,
        debounceMs: 500,
        initialPageSize: 50,
        onFetchData,
    });

    // ---- Actions ----
    const handleConfigClick = (configuration: CPQConfiguration) => {
        router.push(`/configurator/${configuration.template_id}?config=${configuration.id}`);
    };

    const handleDuplicate = async (configId: string) => {
        try {
            const result = await duplicateConfiguration(configId);
            if (result.success) {
                toast.success('Configuration duplicated successfully');
                // Refresh the list
                config.refetch();
            } else {
                toast.error(result.error || 'Failed to duplicate configuration');
            }
        } catch (error: any) {
            toast.error('Failed to duplicate configuration');
        }
    };

    const handleDelete = async (configId: string) => {
        if (!confirm('Are you sure you want to delete this configuration?')) {
            return;
        }

        try {
            const result = await deleteConfiguration(configId);
            if (result.success) {
                toast.success('Configuration deleted successfully');
                // Refresh the list
                config.refetch();
            } else {
                toast.error(result.error || 'Failed to delete configuration');
            }
        } catch (error: any) {
            toast.error('Failed to delete configuration');
        }
    };

    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Search Configurations', icon: null },
        { id: 'status', label: 'Status', icon: null },
    ], []);

    return (
        <EntityViewLayout
            title="My Configurations"
            entityType="cpq_configurations"
            tenantId={tenantId}
            config={config}
            columns={columns}
            onRowClick={handleConfigClick}
            onRowDoubleClick={handleConfigClick}
            availableViewModes={['grid', 'cards']}
            availableFilters={availableFilters}

            // Cards View
            renderCards={(props) => (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pb-24">
                    {props.data.map(config => (
                        <div
                            key={config.id}
                            onClick={() => handleConfigClick(config)}
                            className="group p-6 border border-border rounded-xl hover:border-primary hover:bg-accent/50 hover:shadow-lg transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <FileText className="w-8 h-8 text-primary" />
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${config.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                    config.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                        config.status === 'quoted' ? 'bg-purple-100 text-purple-700' :
                                            'bg-green-100 text-green-700'
                                    }`}>
                                    {config.status}
                                </span>
                            </div>

                            <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                                {config.template_name || 'Configuration'}
                            </h3>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Quantity:</span>
                                    <span className="font-medium">{config.quantity}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total:</span>
                                    <span className="font-medium">${parseFloat(String(config.total_price || 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border">
                                <span className="text-xs text-muted-foreground">
                                    {new Date(config.updated_at).toLocaleDateString()}
                                </span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDuplicate(config.id);
                                        }}
                                        className="p-1 hover:bg-background rounded"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(config.id);
                                        }}
                                        className="p-1 hover:bg-background rounded text-red-600"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        />
    );
}
