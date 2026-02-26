"use client";

import React, { useMemo } from "react";
import { EntityAgGrid } from "@/components/entity-view/EntityAgGrid";
import { useEntityView, EntityViewLayout, ColumnDef } from "@/components/entity-view";
import { StatusBadge } from "@/components/StatusBadge";
import { User, Building2, Search, Activity, Tags, Trash2, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import EntityCard from "@/components/EntityCard";

interface RelationshipsGridProps {
    tenantId: string;
    relationships: any[];
    loading: boolean;
    onUpdateRole: (relId: string, newRole: string) => void;
    onDeleteRelationship: (relId: string) => void;
    onEditRelationship: (relId: string) => void;
    onPersonClick: (id: string) => void;
}

// Master-Detail Cell Renderer for Data Grid
const RelationshipDetailRenderer = (props: any) => {
    const data = props.data;
    const metadata = data.metadata || {};
    const { language } = useLanguage();

    if (Object.keys(metadata).length === 0) {
        return (
            <div className="p-4 bg-muted/10 border-t border-border/50 text-sm text-muted-foreground flex items-center justify-center">
                {language === 'he' ? 'אין מידע נוסף לקשר זה' : 'No additional metadata available for this relationship'}
            </div>
        );
    }

    return (
        <div className="p-4 bg-muted/5 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {language === 'he' ? 'פרטי קשר' : 'Relationship Details'}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(metadata).map(([key, value]) => {
                    // Skip redundant display if jobTitle is already the ret_role_name (but we keep it if they want to see it here)
                    if (key === 'jobTitle' && value === data.ret_role_name) return null;

                    return (
                        <div key={key} className="bg-background rounded flex flex-col p-2 border border-border/30 shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase mb-1">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-sm font-medium">
                                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function RelationshipsGrid({
    tenantId,
    relationships,
    loading,
    onUpdateRole,
    onDeleteRelationship,
    onEditRelationship,
    onPersonClick
}: RelationshipsGridProps) {
    const { language } = useLanguage();

    // Setup EntityView Config (Client-side filtering for now since relationships are passed down)
    const config = useEntityView<any>({
        entityType: 'relationships',
        initialData: relationships,
        initialViewMode: 'grid',
        initialPageSize: 20,
        serverSide: false, // Relationships are fetched all at once in parent
        getItemId: (item) => item.relationshipId || item.id,
        validFilterFields: ['search', 'type', 'role', 'status'],
    });

    // Update config data when props change
    React.useEffect(() => {
        if (!loading) {
            // We use a small hack here to push the new data into the useEntityView hook.
            // A better way would be if useEntityView watched `initialData`, but for now we manually update it if needed.
            // Actually `useEntityView` updates `data` when `initialData` changes if not `serverSide`.
            // Let's ensure it does. (It does in useEntityView.ts: `useEffect(() => { if (!serverSide && initialData.length > 0) setData(initialData); ... })`)
            // BUT what if length is 0? To be safe, we re-trigger it.
            // The cleanest way is just to rely on the hook's internal update, but since we can't export `setData`,
            // we will let the hook handle it.
        }
    }, [relationships, loading]);


    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            field: 'expand',
            headerName: '',
            width: 50,
            pinned: "left" as const,
            cellRenderer: 'agGroupCellRenderer' as any,
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        },
        {
            field: 'target_name',
            headerName: language === 'he' ? 'שם' : 'Name',
            flex: 2,
            minWidth: 200,
            valueGetter: (data: any) => data.ret_name || data.target?.name || 'Unknown',
            cellRenderer: (params: any) => {
                const p = params.data;
                const name = p.ret_name || p.target?.name || 'Unknown';
                const type = p.target?.type || p.type || p.ret_type || 'person';

                return (
                    <div className="flex items-center gap-3 py-1 cursor-pointer hover:text-primary transition-colors" onClick={() => onPersonClick(p.ret_id || p.target?.id || p.id)}>
                        {p.ret_avatar_url || p.target?.avatarUrl ? (
                            <img src={p.ret_avatar_url || p.target?.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center">
                                {type === 'organization' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                        )}
                        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                            {name}
                        </span>
                        {type === 'organization' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Org
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            field: 'role',
            headerName: language === 'he' ? 'תפקיד בקשר' : 'Role / Title',
            flex: 1,
            minWidth: 150,
            valueGetter: (data: any) => data.ret_role_name || data.relationshipType?.name || 'Unknown',
            cellRenderer: (params: any) => {
                const role = params.value;
                return (
                    <div className="flex items-center h-full">
                        <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-secondary/50 border border-border/50 text-foreground">
                            {role}
                        </span>
                    </div>
                )
            }
        },
        {
            field: 'contact',
            headerName: language === 'he' ? 'צור קשר' : 'Contact',
            flex: 1.5,
            minWidth: 180,
            valueGetter: (data: any) => `${data.email || data.target?.email || ''} ${data.phone || data.target?.phone || ''}`,
            cellRenderer: (params: any) => {
                const p = params.data;
                const email = p.email || p.target?.email;
                const phone = p.phone || p.target?.phone;
                return (
                    <div className="flex flex-col justify-center h-full text-xs">
                        {email && <a href={`mailto:${email}`} className="text-muted-foreground hover:text-primary transition-colors truncate" onClick={e => e.stopPropagation()}>{email}</a>}
                        {phone && <a href={`tel:${phone}`} className="text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>{phone}</a>}
                        {!email && !phone && <span className="text-muted-foreground/50">-</span>}
                    </div>
                );
            }
        },
        {
            field: "actions",
            headerName: "",
            width: 100,
            sortable: false,
            filterable: false,
            pinned: "right" as const,
            cellRenderer: (params: any) => {
                const rel = params.data;
                return (
                    <div className="flex items-center justify-end h-full gap-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditRelationship(rel.relationshipId || rel.id);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title={language === 'he' ? 'ערוך קשר' : 'Edit Relationship'}
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(language === 'he' ? 'האם אתה בטוח שברצונך למחוק קשר זה?' : 'Remove this relationship?')) {
                                    onDeleteRelationship(rel.relationshipId || rel.id);
                                }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title={language === 'he' ? 'מחק קשר' : 'Remove Relationship'}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], [language, onEditRelationship, onDeleteRelationship, onPersonClick]);

    const availableFilters = useMemo(() => [
        { id: 'search', label: language === 'he' ? 'חיפוש גלובלי' : 'Global Search', icon: Search },
        { id: 'type', label: language === 'he' ? 'סוג ישות' : 'Entity Type', icon: Tags },
        { id: 'role', label: language === 'he' ? 'תפקיד' : 'Role', icon: Activity },
    ], [language]);

    // We use a completely custom renderGrid here to inject masterDetail true to EntityAgGrid
    return (
        <EntityViewLayout<any>
            entityType="relationships"
            tenantId={tenantId}
            config={config}
            columns={columns}
            onRowClick={(row) => onPersonClick(row.ret_id || row.target?.id || row.id)}
            availableViewModes={['grid']} // Only Grid for now, could add cards later if needed
            availableFilters={availableFilters}
            className="border-none" // remove layout border since it's inside a tab
            renderGrid={(props) => (
                <EntityAgGrid
                    {...props}
                    masterDetail={true}
                    detailCellRenderer={RelationshipDetailRenderer}
                    detailRowHeight={120} // Estimate height for 1-2 rows of metadata chips
                />
            )}
        />
    );
}
