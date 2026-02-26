
"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import PeopleTags from "@/components/PeopleTags";
import { peopleColumns } from "@/components/people/peopleColumns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { exportPeople } from "@/app/actions/exportPeople";
import { bulkDeleteCards } from "@/app/actions/bulkDeleteCards";
import { usePermission } from "@/context/SessionContext";
import EntityCard from "@/components/EntityCard";
import { PortalAccessModal } from "@/components/PortalAccessModal";
import { sendPortalMagicLink } from "@/app/actions/portal-auth-actions";
import { useLanguage } from "@/context/LanguageContext";

interface PeopleViewWrapperProps {
    tenantId: string;
}

export default function PeopleViewWrapper({ tenantId }: PeopleViewWrapperProps) {
    const router = useRouter();
    const canExport = usePermission('export.data');
    const { language } = useLanguage();
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Portal Access Modal State
    const [portalAccess, setPortalAccess] = useState<{ isOpen: boolean, cardId: string, email: string, name: string } | null>(null);

    const handleSendPortalLink = async (email: string) => {
        const loadingToast = toast.loading(language === 'he' ? 'שולח לינק התחברות...' : 'Sending login link...');
        const res = await sendPortalMagicLink(email);
        if (res.success) {
            toast.success(language === 'he' ? 'נשלח בהצלחה!' : 'Link sent perfectly!', { id: loadingToast });
        } else {
            toast.error(res.error || "Failed to send link", { id: loadingToast });
        }
    };

    // Options for Filters
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [roleOptions, setRoleOptions] = useState<any[]>([]);

    // Fetch Options
    useEffect(() => {
        if (!tenantId) return;

        const fetchOpt = async (code: string, setter: (v: any[]) => void) => {
            try {
                const res = await fetch(`/api/options?code=${code}&tenantId=${tenantId}`);
                const json = await res.json();
                if (json.data) setter(json.data);
            } catch (e) {
                console.error(`Failed to fetch options ${code}`, e);
            }
        };

        fetchOpt('PERSON_STATUS', setStatusOptions);
        fetchOpt('PERSON_ROLE', setRoleOptions);
    }, [tenantId]);

    // ---- Server-Side Data Fetching ----
    const onFetchData = useCallback(async (params: FetchDataParams): Promise<FetchDataResult<any>> => {
        const payload = {
            filters: params.filters,
            searchQuery: params.searchQuery,
            sorting: params.sorting,
            pagination: params.pagination,
            tenantId
        };

        const res = await fetch('/api/people', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();

        if (!res.ok) {
            throw new Error(json.error || 'Failed to fetch people');
        }

        return {
            data: json.data || [],
            totalRecords: json.totalRecords || 0,
            totalPages: json.totalPages || 0
        };
    }, [tenantId]);

    // ---- Hook ----
    const config = useEntityView<any>({
        entityType: 'people',
        serverSide: true,
        debounceMs: 500, // Enterprise Requirement
        initialPageSize: 50,
        onFetchData,
        getItemId: (item) => item.id || item.ret_id,
        validFilterFields: ['search', 'status', 'role', 'email', 'phone'],
    });

    // ---- Actions ----
    const handlePersonClick = (item: any) => {
        const id = item.id || item.ret_id;
        const type = item.type || item.ret_type;
        console.log('[NAV] People handlePersonClick:', id, type);

        sessionStorage.setItem('lastClickedPersonId', id);

        const target = type === 'organization'
            ? `/dashboard/organizations/${id}`
            : `/dashboard/people/${id}`;
        config.navigateTo(target);
    };

    const handleExport = async () => {
        toast.info("Preparing export...");
        try {
            // Logic to export with current filters could be passed here
            const res = await exportPeople();
            if (res.success && res.data?.csv) {
                const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `people_export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success("Export downloaded");
            } else {
                toast.error(!res.success ? res.error : "Export failed");
            }
        } catch (e) {
            toast.error("An error occurred during export");
        }
    };

    // ---- Available Filters ----
    const availableFilters = useMemo(() => [
        { id: 'search', label: 'Global Search', icon: null }, // Handled by search bar mainly, but can be explicit
        { id: 'status', label: 'Status', icon: null },
        { id: 'role', label: 'Role', icon: null },
        { id: 'email', label: 'Email', icon: null },
        { id: 'phone', label: 'Phone', icon: null },
    ], []);

    // Add dynamic Action column
    const gridColumns = useMemo(() => {
        return [
            ...peopleColumns,
            {
                field: "actions",
                headerName: "",
                width: 100,
                sortable: false,
                filter: false,
                pinned: "right" as const,
                cellRenderer: (params: any) => {
                    const person = params.data;
                    const email = person.email || person.ret_email;
                    return (
                        <div className="flex items-center justify-end h-full gap-2 px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                            {email && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPortalAccess({
                                            isOpen: true,
                                            cardId: person.id || person.ret_id,
                                            email: email,
                                            name: `${person.first_name || person.ret_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
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
            }
        ];
    }, [language]);

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        const res = await bulkDeleteCards(ids);
        if (res.success) {
            toast.success(`${res.data.deleted} רשומות נמחקו בהצלחה`);
        } else {
            toast.error(res.error || 'שגיאה במחיקה');
        }
    }, []);

    return (
        <>
            <EntityViewLayout
                title="People"
                entityType="people"
                tenantId={tenantId}
                config={config}
                columns={gridColumns}
                enableExport={canExport}
                onExport={handleExport}
                onBulkDelete={handleBulkDelete}
                availableViewModes={['tags', 'grid', 'cards']}
                availableFilters={availableFilters}
                filterOptions={{
                    status: statusOptions,
                    role: roleOptions
                }}

                // Render Overrides
                renderTags={(props) => (
                    <PeopleTags
                        people={props.data}
                        loading={props.loading}
                        hasMore={false} // Server side pagination doesn't really map to 'hasMore' infinite scroll unless we implement it differently, but PeopleTags might expect infinite scroll. 
                        // For now, passing false to disable loadMore trigger in PeopleTags, relying on Pagination.
                        // Or we can wire loadMore to config.setPagination({ page: config.pagination.page + 1 })
                        loadMore={() => config.setPagination({ page: config.pagination.page + 1 })}
                        tenantId={tenantId}
                        onPersonClick={(id, type) => handlePersonClick({ id, type })}
                        highlightId={highlightId}
                        recentSearches={[]} // Handled by Layout now
                        onSearchHistoryClick={(term) => config.setSearchTerm(term)}
                    />
                )}
                renderCards={(props) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pb-24">
                        {props.data.map((person) => (
                            <EntityCard
                                key={person.id || person.ret_id}
                                tenantId={tenantId}
                                entity={{
                                    id: person.id || person.ret_id,
                                    displayName: `${person.first_name || person.ret_name || ''} ${person.last_name || ''}`.trim() || person.company_name || 'Unknown',
                                    type: person.type || person.ret_type || 'person',
                                    cardType: person.card_type,
                                    status: person.status || person.ret_status,
                                    industry: person.role || person.ret_role_name || person.role_name || person.industry,
                                    email: person.email || person.ret_email,
                                    phone: person.phone || person.ret_phone,
                                    firstName: person.first_name,
                                    lastName: person.last_name,
                                    jobTitle: person.job_title,
                                    companyName: person.company_name,
                                    employeeCount: person.employee_count,
                                    annualRevenue: person.annual_revenue
                                }}
                                onEdit={(id) => handlePersonClick({ id, type: person.type || person.ret_type })}
                                onNavigate={(id) => handlePersonClick({ id, type: person.type || person.ret_type })}
                                onGrantAccess={(id, email) => setPortalAccess({
                                    isOpen: true,
                                    cardId: id,
                                    email: email || '',
                                    name: `${person.first_name || person.ret_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
                                })}
                                onCreateQuote={(id) => router.push('/dashboard/sales/quotes/new?customerId=' + id)}
                            />
                        ))}
                    </div>
                )}
            />

            {portalAccess && (
                <PortalAccessModal
                    isOpen={portalAccess.isOpen}
                    onClose={() => setPortalAccess(null)}
                    tenantId={tenantId}
                    cardId={portalAccess.cardId}
                    customerEmail={portalAccess.email}
                    customerName={portalAccess.name}
                />
            )}
        </>
    );
}
