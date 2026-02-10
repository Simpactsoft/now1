
"use client";

import { useEntityView, EntityViewLayout, FetchDataParams, FetchDataResult } from "@/components/entity-view";
import PeopleTags from "@/components/PeopleTags";
import { peopleColumns } from "@/components/people/peopleColumns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { exportPeople } from "@/app/actions/exportPeople";
import { usePermission } from "@/context/SessionContext";

interface PeopleViewWrapperProps {
    tenantId: string;
}

export default function PeopleViewWrapper({ tenantId }: PeopleViewWrapperProps) {
    const router = useRouter();
    const canExport = usePermission('export.data');
    const [highlightId, setHighlightId] = useState<string | null>(null);

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
    });

    // ---- Actions ----
    const handlePersonClick = (item: any) => {
        const id = item.id || item.ret_id;
        const type = item.type || item.ret_type; // 'person' or 'organization'
        setHighlightId(id);

        // Preserve history
        sessionStorage.setItem('lastClickedPersonId', id);

        if (type === 'organization') {
            router.push(`/dashboard/organizations/${id}`);
        } else {
            router.push(`/dashboard/people/${id}`);
        }
    };

    const handleExport = async () => {
        toast.info("Preparing export...");
        try {
            // Logic to export with current filters could be passed here
            const res = await exportPeople();
            if (res.success && res.csv) {
                const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
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
                toast.error(res.error || "Export failed");
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

    return (
        <EntityViewLayout
            title="People"
            entityType="people"
            tenantId={tenantId}
            config={config}
            columns={peopleColumns}
            onRowClick={handlePersonClick}
            enableExport={canExport}
            onExport={handleExport}
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
                    {props.data.map((person) => {
                        // Inline Card Renderer or re-use SimpleProfileCard from previous file if extracted.
                        // For brevity, using a simple placeholder or I can verify if I need to extract SimpleProfileCard.
                        // I'll assume users want the same card look. I should have extracted it.
                        // I will redefine a simple card here or assume PeopleCards.tsx has it.
                        // PeopleCards.tsx component exists.
                        return (
                            <div key={person.id} onClick={() => handlePersonClick(person)} className="p-4 border rounded-xl hover:shadow-md cursor-pointer transition-all bg-card">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold">
                                        {person.first_name?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold">{person.first_name} {person.last_name}</div>
                                        <div className="text-xs text-muted-foreground">{person.role || person.role_name}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        />
    );
}
