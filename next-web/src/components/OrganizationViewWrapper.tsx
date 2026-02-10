
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEntityView, EntityViewLayout, ColumnDef } from "@/components/entity-view";
import OrganizationTags from "@/components/OrganizationTags";
import EntityCard from "@/components/EntityCard";
import { fetchOrganizations } from "@/app/actions/fetchOrganizations";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Search, Activity, Factory, Building2, Tags, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { FetchDataParams, FetchDataResult } from "@/components/entity-view";

interface OrganizationViewWrapperProps {
    user: any;
    tenantId: string;
}

export default function OrganizationViewWrapper({ user, tenantId }: OrganizationViewWrapperProps) {
    const router = useRouter();
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Options for SmartChip filters
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [industryOptions, setIndustryOptions] = useState<any[]>([]);
    const [sizeOptions, setSizeOptions] = useState<any[]>([]);

    // Fetch Options on Mount
    useEffect(() => {
        const fetchOptions = async (code: string, setter: (val: any[]) => void) => {
            try {
                const res = await fetch(`/api/options?code=${code}&tenantId=${tenantId}`);
                if (res.ok) {
                    const json = await res.json();
                    setter(json.data || []);
                }
            } catch (err) {
                console.error(`Failed to fetch options for ${code}`, err);
            }
        };

        fetchOptions('ORGANIZATION_STATUS', setStatusOptions);
        fetchOptions('ORGANIZATION_INDUSTRY', setIndustryOptions);
        fetchOptions('COMPANY_SIZE', setSizeOptions);
    }, [tenantId]);

    // ---- Server-Side Data Fetching ----
    const onFetchData = useCallback(async (params: FetchDataParams): Promise<FetchDataResult<any>> => {
        const { filters, searchQuery, sorting, pagination } = params;

        // Build filterModel
        const filterModel: any = {};
        filters.forEach(f => {
            if (f.isEnabled && f.value) {
                filterModel[f.field] = { filter: f.value, type: f.operator };
            }
        });

        const startRow = (pagination.page - 1) * pagination.pageSize;

        const res = await fetchOrganizations({
            startRow,
            endRow: startRow + pagination.pageSize,
            filterModel,
            sortModel: sorting.length > 0 ? sorting : [{ colId: 'updated_at', sort: 'desc' }],
            tenantId,
            query: searchQuery || undefined,
        });

        if (res.error) {
            throw new Error(res.error);
        }

        const totalRecords = res.rowCount || 0;
        return {
            data: res.rowData || [],
            totalRecords,
            totalPages: Math.ceil(totalRecords / pagination.pageSize),
        };
    }, [tenantId]);

    // ---- useEntityView ----
    const config = useEntityView<any>({
        entityType: 'organizations',
        initialViewMode: 'tags',
        initialPageSize: 50,
        serverSide: true,
        onFetchData,
        getItemId: (item) => item.ret_id,
    });

    // Restore Highlight
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const lastId = sessionStorage.getItem('lastClickedOrgId');
            if (lastId) {
                setHighlightId(lastId);
                setTimeout(() => {
                    const el = document.getElementById(`org-${lastId}`) || document.getElementById(`row-${lastId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        }
    }, []);

    const handleRowClick = useCallback((item: any) => {
        const id = item.ret_id || item.id;
        setHighlightId(id);
        sessionStorage.setItem('lastClickedOrgId', id);
        router.push(`/dashboard/organizations/${id}`);
    }, [router]);

    // ---- Column Definitions ----
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            field: 'ret_name',
            headerName: 'Organization',
            sortable: true,
            filterable: true,
            flex: 2,
            minWidth: 200,
            cellRenderer: (params: any) => {
                const data = params.data;
                if (!data) return null;
                return (
                    <div className="flex items-center gap-3 py-1">
                        {data.ret_avatar_url ? (
                            <img src={data.ret_avatar_url} alt="" className="w-8 h-8 rounded-md object-cover border" />
                        ) : (
                            <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                                <Building2 className="w-4 h-4" />
                            </div>
                        )}
                        <span className="font-medium text-foreground">{data.ret_name}</span>
                    </div>
                );
            },
        },
        {
            field: 'ret_status',
            headerName: 'Status',
            sortable: true,
            width: 130,
            cellRenderer: (params: any) => {
                const status = params.value;
                return (
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border",
                        status === 'ACTIVE' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                            status === 'CHURNED' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                "bg-secondary text-secondary-foreground border-border"
                    )}>
                        {status}
                    </span>
                );
            },
        },
        {
            field: 'ret_industry',
            headerName: 'Industry',
            sortable: false,
            width: 150,
        },
        {
            field: 'ret_size',
            headerName: 'Size',
            sortable: false,
            width: 100,
        },
        {
            field: 'ret_updated_at',
            headerName: 'Last Active',
            sortable: true,
            width: 140,
            valueFormatter: (value: any) => {
                if (!value) return '-';
                try { return formatDistanceToNow(new Date(value), { addSuffix: true }); }
                catch { return '-'; }
            },
        },
    ], []);

    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Global Search', icon: Search },
        { id: 'status', label: 'Status', icon: Activity },
        { id: 'industry', label: 'Industry', icon: Factory },
        { id: 'company_size', label: 'Size', icon: Building2 },
        { id: 'tags', label: 'Tags', icon: Tags },
    ], []);

    return (
        <EntityViewLayout<any>
            entityType="organizations"
            tenantId={tenantId}
            columns={columns}
            config={config}
            onRowClick={handleRowClick}
            availableViewModes={['tags', 'grid', 'cards']}
            availableFilters={availableFilters}
            filterOptions={{
                status: statusOptions,
                industry: industryOptions,
                company_size: sizeOptions
            }}
            renderTags={(props) => (
                <OrganizationTags
                    data={props.data}
                    loading={props.loading}
                    hasMore={false}
                    loadMore={() => { }}
                    onRowClick={(id) => handleRowClick({ ret_id: id })}
                    highlightId={highlightId}
                />
            )}
            renderCards={(props) => (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pb-24">
                    {props.data.map((org: any) => (
                        <EntityCard
                            key={org.ret_id}
                            tenantId={tenantId}
                            entity={{
                                id: org.ret_id,
                                displayName: org.ret_name,
                                type: org.ret_type,
                                status: org.ret_status,
                                industry: org.ret_industry,
                                email: org.ret_email,
                                phone: org.ret_phone,
                                website: org.ret_website,
                                location: [org.ret_city, org.ret_country].filter(Boolean).join(", ")
                            }}
                            onEdit={(id) => handleRowClick({ ret_id: id })}
                        />
                    ))}
                    {props.loading && (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={`skel-${i}`} className="h-48 rounded-xl bg-muted/20 animate-pulse border border-border/50" />
                        ))
                    )}
                </div>
            )}
        />
    );
}
