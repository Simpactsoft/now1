
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useViewConfig } from "@/components/universal/ViewConfigContext";
import EntityViewLayout from "@/components/EntityViewLayout";
import SimpleOrganizationTable from "@/components/SimpleOrganizationTable";
import OrganizationTags from "@/components/OrganizationTags";
import EntityCard from "@/components/EntityCard";
import { fetchOrganizations } from "@/app/actions/fetchOrganizations";
import { fetchTotalStats } from "@/app/actions/fetchStats";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Activity, Factory, Building2, Tags } from "lucide-react";

interface OrganizationViewWrapperProps {
    user: any;
    tenantId: string;
}

export default function OrganizationViewWrapper({ user, tenantId }: OrganizationViewWrapperProps) {
    const { viewMode, filters, sort, searchTerm, dispatch, activeSavedView } = useViewConfig();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Data State
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0); // From Stats
    const [filteredCount, setFilteredCount] = useState(0); // From fetchOrganizations
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Options for Filters
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

        // Initial Stats
        fetchTotalStats(tenantId).then(res => {
            if (res.totalOrganizations !== undefined) setTotalCount(res.totalOrganizations);
        });

    }, [tenantId]);

    // Data Fetching Logic
    const loadMore = useCallback(async (reset = false) => {
        if (loading && !reset) return;
        setLoading(true);

        const currentLength = reset ? 0 : organizations.length;
        const limit = 50;

        // Construct Filter Model
        const filterModel: any = {};
        filters.forEach(f => {
            if (f.isEnabled && f.value) {
                filterModel[f.field] = { filter: f.value, type: f.operator };
            }
        });

        const res = await fetchOrganizations({
            startRow: currentLength,
            endRow: currentLength + limit,
            filterModel,
            sortModel: sort,
            tenantId,
            query: searchTerm
        });

        if (res.error) {
            toast.error("Failed to load organizations");
            setLoading(false);
            return;
        }

        if (reset) {
            setOrganizations(res.rowData || []);
        } else {
            setOrganizations(prev => {
                const newItems = res.rowData || [];
                const existingIds = new Set(prev.map(p => p.ret_id));
                const filteredNew = newItems.filter((i: any) => !existingIds.has(i.ret_id));
                return [...prev, ...filteredNew];
            });
        }

        setFilteredCount(res.rowCount || 0);
        setHasMore((currentLength + (res.rowData?.length || 0)) < (res.rowCount || 0));
        setLoading(false);
        setLastRefreshed(new Date());

    }, [filters, sort, searchTerm, tenantId, organizations.length, loading]);

    // Trigger Fetch on View Config Change
    useEffect(() => {
        // Debounce search slightly handled by input, but mostly instant here
        const timer = setTimeout(() => {
            loadMore(true);
        }, 100);
        return () => clearTimeout(timer);
    }, [filters, sort, searchTerm, activeSavedView]); // activeSavedView change triggers filters change usually

    // Restore Highlight
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const lastId = sessionStorage.getItem('lastClickedOrgId');
            if (lastId) {
                setHighlightId(lastId);
                // Try scrolling into view after a short delay to allow rendering
                setTimeout(() => {
                    const el = document.getElementById(`org-${lastId}`) || document.getElementById(`row-${lastId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        }
    }, []);

    const handleRowClick = (id: string) => {
        setHighlightId(id);
        sessionStorage.setItem('lastClickedOrgId', id);
        router.push(`/dashboard/organizations/${id}`);
    };

    const handleExport = () => {
        toast.info("Export not implemented yet");
    };

    // Available Filters Config
    const availableFilters = [
        { id: 'search', label: 'Global Search', icon: Search },
        { id: 'status', label: 'Status', icon: Activity },
        { id: 'industry', label: 'Industry', icon: Factory },
        { id: 'company_size', label: 'Size', icon: Building2 },
        { id: 'tags', label: 'Tags', icon: Tags },
    ];

    return (
        <>

            <EntityViewLayout
                tenantId={tenantId}
                totalCount={totalCount}
                filteredCount={filteredCount}
                lastRefreshed={lastRefreshed}
                loading={loading}
                onRefresh={(reset) => loadMore(reset)}
                onExport={handleExport}
                canExport={false}
                // searchHistory={[]} // Todo
                availableFilters={availableFilters}
                filterOptions={{
                    status: statusOptions,
                    industry: industryOptions,
                    company_size: sizeOptions
                }}
                renderGrid={() => (
                    <SimpleOrganizationTable
                        data={organizations}
                        loading={loading}
                        hasMore={hasMore}
                        loadMore={() => loadMore(false)}
                        onRowClick={handleRowClick}
                        highlightId={highlightId}
                    />
                )}
                renderTags={() => (
                    <OrganizationTags
                        data={organizations}
                        loading={loading}
                        hasMore={hasMore}
                        loadMore={() => loadMore(false)}
                        onRowClick={handleRowClick}
                        highlightId={highlightId}
                    />
                )}
                renderCards={() => (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pb-24">
                        {organizations.map((org: any) => (
                            <EntityCard
                                key={org.ret_id}
                                tenantId={tenantId}
                                isHighlighted={highlightId === org.ret_id}
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
                                onEdit={(id) => handleRowClick(id)}
                            />
                        ))}
                        {loading && (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={`skel-${i}`} className="h-48 rounded-xl bg-muted/20 animate-pulse border border-border/50" />
                            ))
                        )}
                    </div>
                )}
            />
        </>
    );
}
