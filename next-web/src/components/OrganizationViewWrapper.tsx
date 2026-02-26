
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEntityView, EntityViewLayout, ColumnDef } from "@/components/entity-view";
import OrganizationTags from "@/components/OrganizationTags";
import EntityCard from "@/components/EntityCard";
import { PortalAccessModal } from "@/components/PortalAccessModal";
import { fetchOrganizations } from "@/app/actions/fetchOrganizations";
import { bulkDeleteCards } from "@/app/actions/bulkDeleteCards";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { sendPortalMagicLink } from "@/app/actions/portal-auth-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Activity, Factory, Building2, Tags, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { FetchDataParams, FetchDataResult } from "@/components/entity-view";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

interface OrganizationViewWrapperProps {
    user: any;
    tenantId: string;
}

export default function OrganizationViewWrapper({ user, tenantId }: OrganizationViewWrapperProps) {
    const router = useRouter();
    const { language } = useLanguage();
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Portal Access Modal State
    const [portalAccess, setPortalAccess] = useState<{ isOpen: boolean, cardId: string, email: string, name: string } | null>(null);

    const handleSendPortalLink = async (email: string) => {
        const loadingToast = toast.loading('Sending login link...');
        const res = await sendPortalMagicLink(email);
        if (res.success) {
            toast.success('Link sent perfectly!', { id: loadingToast });
        } else {
            toast.error(res.error || "Failed to send link", { id: loadingToast });
        }
    };

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
        validFilterFields: ['search', 'status', 'industry', 'company_size', 'tags'],
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
        console.log('[NAV] Org handleRowClick:', id);
        sessionStorage.setItem('lastClickedOrgId', id);
        config.navigateTo(`/dashboard/organizations/${id}`);
    }, [config.navigateTo]);

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
                const id = data.id || data.ret_id;
                return (
                    <Link href={`/dashboard/organizations/${id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 py-1 group w-full cursor-pointer hover:bg-slate-50/50 rounded-md transition-colors">
                        {data.ret_avatar_url ? (
                            <img src={data.ret_avatar_url} alt="" className="w-8 h-8 rounded-md object-cover border shrink-0" />
                        ) : (
                            <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center text-muted-foreground shrink-0">
                                <Building2 className="w-4 h-4" />
                            </div>
                        )}
                        <span className="font-medium text-foreground group-hover:underline group-hover:text-blue-600 truncate">{data.ret_name}</span>
                    </Link>
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
                if (!status) return null;
                return (
                    <StatusBadge
                        status={status}
                        tenantId={tenantId}
                        code="ORGANIZATION_STATUS"
                    />
                );
            },
        },
        {
            field: 'ret_industry',
            headerName: 'Industry',
            sortable: false,
            width: 150,
            cellRenderer: (params: any) => {
                const industry = params.value;
                if (!industry) return <span className="text-muted-foreground/30">-</span>;
                return (
                    <StatusBadge
                        status={industry}
                        tenantId={tenantId}
                        code="ORGANIZATION_INDUSTRY"
                        className="bg-transparent border-gray-200 text-gray-700"
                    />
                );
            },
        },
        {
            field: 'ret_size',
            headerName: 'Size',
            sortable: false,
            width: 100,
            cellRenderer: (params: any) => {
                const size = params.value;
                if (!size) return <span className="text-muted-foreground/30">-</span>;
                return (
                    <StatusBadge
                        status={size}
                        tenantId={tenantId}
                        code="COMPANY_SIZE"
                        className="bg-transparent border-gray-200 text-gray-700"
                    />
                );
            },
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
        {
            field: "actions",
            headerName: "",
            width: 80,
            sortable: false,
            filter: false,
            pinned: "right" as const,
            cellRenderer: (params: any) => {
                const org = params.data;
                const email = org.email || org.ret_email;
                return (
                    <div className="flex items-center justify-end h-full gap-2 px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                        {email && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPortalAccess({
                                        isOpen: true,
                                        cardId: org.id || org.ret_id,
                                        email: email,
                                        name: org.company_name || org.ret_name || 'Unknown'
                                    });
                                }}
                                className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                                title={language === 'he' ? 'חיבור לפורטל' : 'Portal Access'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></svg>
                            </button>
                        )}
                    </div>
                );
            }
        },
    ], [language]);

    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Global Search', icon: Search },
        { id: 'status', label: 'Status', icon: Activity },
        { id: 'industry', label: 'Industry', icon: Factory },
        { id: 'company_size', label: 'Size', icon: Building2 },
        { id: 'tags', label: 'Tags', icon: Tags },
    ], []);

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        const res = await bulkDeleteCards(ids);
        if (res.success) {
            toast.success(`${res.data.deleted} ארגונים נמחקו בהצלחה`);
        } else {
            toast.error(res.error || 'שגיאה במחיקה');
        }
    }, []);

    return (
        <>
            <EntityViewLayout<any>
                entityType="organizations"
                tenantId={tenantId}
                columns={columns}
                config={config}
                onBulkDelete={handleBulkDelete}
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
                                    type: org.ret_type || 'organization',
                                    cardType: org.card_type || 'organization',
                                    status: org.ret_status,
                                    industry: org.ret_industry,
                                    email: org.ret_email,
                                    phone: org.ret_phone,
                                    website: org.ret_website,
                                    location: [org.ret_city, org.ret_country].filter(Boolean).join(", "),
                                    companyName: org.company_name || org.ret_name,
                                    employeeCount: org.employee_count || org.ret_size ? parseInt(org.ret_size) : undefined,
                                    annualRevenue: org.annual_revenue
                                }}
                                onEdit={(id) => handleRowClick({ ret_id: id })}
                                onGrantAccess={(id, email) => setPortalAccess({
                                    isOpen: true,
                                    cardId: id,
                                    email: email || '',
                                    name: org.ret_name
                                })}
                                onCreateQuote={(id) => router.push('/dashboard/sales/quotes/new?customerId=' + id)}
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

            {
                portalAccess && (
                    <PortalAccessModal
                        isOpen={portalAccess.isOpen}
                        onClose={() => setPortalAccess(null)}
                        tenantId={tenantId}
                        cardId={portalAccess.cardId}
                        customerEmail={portalAccess.email}
                        customerName={portalAccess.name}
                    />
                )
            }
        </>
    );
}
