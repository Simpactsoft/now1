"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEntityView, EntityViewLayout, ColumnDef } from "@/components/entity-view";
import { EntityAgGrid } from "@/components/entity-view/EntityAgGrid";
import { User, Building2, Search, Briefcase } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { fetchGlobalRelationshipsAction, fetchRelationshipTypesAction } from "@/app/actions/relationships";

interface RelationshipsGlobalWrapperProps {
    tenantId: string;
}

// Master-Detail Cell Renderer for Data Grid
const GlobalRelationshipDetailRenderer = (props: any) => {
    const row = props.data;
    if (!row) return null;
    return (
        <div style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.6 }}>
            <div><strong>Source:</strong> {row.source_name} ({row.source_type})</div>
            <div><strong>Target:</strong> {row.target_name} ({row.target_type})</div>
            <div><strong>Type:</strong> {row.rel_type_name}</div>
            {row.source_email && <div><strong>Source Email:</strong> {row.source_email}</div>}
            {row.target_email && <div><strong>Target Email:</strong> {row.target_email}</div>}
        </div>
    );
};

export default function RelationshipsGlobalWrapper({ tenantId }: RelationshipsGlobalWrapperProps) {
    const router = useRouter();
    const { language } = useLanguage();

    const [relationshipTypeOptions, setRelationshipTypeOptions] = useState<any[]>([]);

    useEffect(() => {
        const loadTypes = async () => {
            const types = await fetchRelationshipTypesAction(tenantId);
            setRelationshipTypeOptions(types);
        };
        loadTypes();
    }, [tenantId]);

    const entityTypeOptions = useMemo(() => [
        { value: 'person', label: language === 'he' ? 'איש קשר' : 'Person' },
        { value: 'organization', label: language === 'he' ? 'ארגון' : 'Organization' },
    ], [language]);

    const onFetchData = useCallback(async (params: any) => {
        const filterModel: any = {};

        // Map entity-view filters to AG Grid filterModel format expected by the action
        if (params.searchQuery) filterModel.search = { filter: params.searchQuery };
        if (params.filters) {
            params.filters.forEach((f: any) => {
                if (f.isEnabled && f.value) {
                    filterModel[f.field] = { filter: f.value };
                }
            });
        }

        const sortModel = params.sorting?.map((s: any) => ({
            colId: s.field,
            sort: s.direction,
        })) || [];

        const startRow = ((params.pagination?.page ?? 1) - 1) * (params.pagination?.pageSize ?? 50);
        const endRow = startRow + (params.pagination?.pageSize ?? 50);

        const result = await fetchGlobalRelationshipsAction({
            tenantId,
            startRow,
            endRow,
            filterModel,
            sortModel,
            query: params.searchQuery,
        });

        if ('error' in result) {
            throw new Error(result.error);
        }

        const pageSize = params.pagination?.pageSize ?? 50;
        return {
            data: result.rowData || [],
            totalRecords: result.rowCount || 0,
            totalPages: Math.ceil((result.rowCount || 0) / pageSize),
        };
    }, [tenantId]);

    const config = useEntityView<any>({
        entityType: 'relationships',
        serverSide: true,
        debounceMs: 400,
        initialPageSize: 50,
        initialViewMode: 'grid',
        onFetchData,
        getItemId: (item) => item.id || item.relationshipId,
        validFilterFields: ['search', 'rel_type_name', 'source_type', 'target_type'],
    });

    const handleEntityClick = useCallback((e: React.MouseEvent, id: string, type: string) => {
        e.stopPropagation();
        const path = type === 'organization'
            ? `/dashboard/organizations/${id}`
            : `/dashboard/people/${id}`;
        config.navigateTo(path);
    }, [config.navigateTo]);

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            field: 'source_name',
            headerName: language === 'he' ? 'צד א׳' : 'Source',
            flex: 1,
            minWidth: 160,
            filterable: false,
            cellRenderer: (params: any) => {
                const row = params.data;
                if (!row) return null;
                const path = `/dashboard/${row.source_type === 'person' ? 'people' : 'organizations'}/${row.source_id}`;
                return (
                    <Link
                        href={path}
                        onClick={(e) => e.stopPropagation()}
                        className="text-left hover:underline text-blue-600 font-medium inline-flex items-center"
                    >
                        {row.source_type === 'person' ? <User size={14} className="inline mr-1.5 text-muted-foreground shrink-0" /> : <Building2 size={14} className="inline mr-1.5 text-muted-foreground shrink-0" />}
                        <span className="truncate">{row.source_name}</span>
                    </Link>
                );
            },
        },
        {
            field: 'rel_type_name',
            headerName: language === 'he' ? 'סוג קשר' : 'Relationship Type',
            width: 170,
            filterable: false,
        },
        {
            field: 'target_name',
            headerName: language === 'he' ? 'צד ב׳' : 'Target',
            flex: 1,
            minWidth: 160,
            filterable: false,
            cellRenderer: (params: any) => {
                const row = params.data;
                if (!row) return null;
                const path = `/dashboard/${row.target_type === 'person' ? 'people' : 'organizations'}/${row.target_id}`;
                return (
                    <Link
                        href={path}
                        onClick={(e) => e.stopPropagation()}
                        className="text-left py-1 hover:underline text-blue-600 font-medium inline-flex items-center"
                    >
                        {row.target_type === 'person' ? <User size={14} className="inline mr-1.5 text-muted-foreground shrink-0" /> : <Building2 size={14} className="inline mr-1.5 text-muted-foreground shrink-0" />}
                        <span className="truncate">{row.target_name}</span>
                    </Link>
                );
            },
        },
    ], [language, handleEntityClick]);

    const availableFilters = useMemo(() => [
        { id: 'search', label: language === 'he' ? 'חיפוש חופשי (משפיע על שני הצדדים)' : 'Global Search (Both Entities)', icon: Search },
        { id: 'rel_type_name', label: language === 'he' ? 'סוג קשר' : 'Type', icon: Briefcase },
        { id: 'source_type', label: language === 'he' ? 'סוג ישות צד א׳' : 'Source Type', icon: User },
        { id: 'target_type', label: language === 'he' ? 'סוג ישות צד ב׳' : 'Target Type', icon: Building2 },
    ], [language]);

    return (
        <EntityViewLayout<any>
            entityType="relationships"
            tenantId={tenantId}
            config={config}
            columns={columns}
            availableViewModes={['grid']}
            availableFilters={availableFilters}
            filterOptions={{
                rel_type_name: relationshipTypeOptions,
                source_type: entityTypeOptions,
                target_type: entityTypeOptions
            }}
            renderGrid={(props) => (
                <EntityAgGrid
                    {...props}
                    masterDetail={true}
                    detailCellRenderer={GlobalRelationshipDetailRenderer}
                    detailRowHeight={100}
                    rowHeight={56}
                />
            )}
        />
    );
}
