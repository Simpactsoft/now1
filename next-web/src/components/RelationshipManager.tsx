"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import EntityPicker from "@/components/universal/EntityPicker";
import { Plus, X, Link as LinkIcon, Briefcase, LayoutList, LayoutGrid, Tags, User, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addRelationshipAction, removeRelationshipAction, fetchRelationshipsAction, updateRelationshipAction } from "@/app/actions/relationships";
import { createClient } from "@/lib/supabase/client";

// Reusable Components
import SimplePeopleTable from "@/components/SimplePeopleTable";
import PeopleTags from "@/components/PeopleTags";
import EntityCard from "@/components/EntityCard";

interface Relationship {
    id: string; // The relationship ID
    target: {
        id: string;
        name: string;
        type: 'person' | 'organization';
        avatarUrl?: string;
    };
    type: {
        id: string;
        name: string;
    };
    metadata?: any;
}

interface RelationshipManagerProps {
    tenantId: string;
    entityId: string; // The ID of the person or org we are looking at
    entityType: 'person' | 'organization';
}

type ViewMode = 'list' | 'cards' | 'tags';

export default function RelationshipManager({ tenantId, entityId, entityType }: RelationshipManagerProps) {
    const [relationships, setRelationships] = useState<any[]>([]); // Enriched Data
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // View View State
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const [statusOptions, setStatusOptions] = useState<any[]>([]);

    // Configurable Types State (TODO: Fetch from config)
    const [selectedType, setSelectedType] = useState("Employee");

    const availableTypes = ['Employee', 'Manager', 'Partner', 'Supplier', 'Investor', 'Board Member'];

    useEffect(() => {
        loadRelationships();

        // Fetch Status Options for Grid
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options", err));
    }, [entityId]);

    const loadRelationships = async () => {
        setLoading(true);
        const res = await fetchRelationshipsAction(tenantId, entityId);
        if (res.error) {
            console.error(res.error);
            setRelationships([]);
        } else {
            setRelationships(res.data || []);
        }
        setLoading(false);
    };

    const [selectedEntity, setSelectedEntity] = useState<any>(null); // For Metadata Dialog
    const [metadata, setMetadata] = useState({ jobTitle: '', startDate: '' });
    const [editingRel, setEditingRel] = useState<any>(null); // For Edit Mode

    const handleInitialSelect = (entity: any) => {
        setSelectedEntity(entity);
        setMetadata({ jobTitle: '', startDate: '' });
        setEditingRel(null);
    };

    const handleConfirmAdd = async () => {
        if (!selectedEntity) return;

        const entity = selectedEntity;
        const metaPayload = { jobTitle: metadata.jobTitle, startDate: metadata.startDate };
        const isEdit = !!editingRel;

        try {
            // Optimistic Update
            if (isEdit) {
                setRelationships(prev => prev.map(r => r === editingRel ? { ...r, metadata: metaPayload, ret_role_name: metaPayload.jobTitle } : r));
            } else {
                const tempId = Math.random().toString();
                const newRel: any = {
                    ret_id: entity.id,
                    ret_name: entity.name,
                    ret_role_name: metaPayload.jobTitle,
                    relationshipId: tempId,
                    relationshipType: { name: selectedType, id: 'temp' },
                    metadata: metaPayload,
                    email: '', phone: ''
                };
                setRelationships(prev => [...prev, newRel]);
            }

            setIsAdding(false);
            setSelectedEntity(null);
            setEditingRel(null);

            let res;
            if (isEdit) {
                res = await updateRelationshipAction(tenantId, editingRel.relationshipId || editingRel.id, selectedType, metaPayload);
            } else {
                res = await addRelationshipAction(tenantId, entityId, entity.id, selectedType, metaPayload);
            }

            if (res.error) {
                toast.error(res.error);
                loadRelationships(); // Revert
            } else {
                toast.success(isEdit ? "Relationship updated" : "Relationship linked");
                loadRelationships();
            }
        } catch (e) {
            toast.error("Failed to save");
            loadRelationships();
        }
    };

    const handleCancelAdd = () => {
        setSelectedEntity(null);
        setIsAdding(false);
    };

    const handleUpdateRole = async (relId: string, newRole: string) => {
        // Optimistic
        const oldRel = relationships.find(r => r.relationshipId === relId);
        setRelationships(prev => prev.map(r => r.relationshipId === relId ? { ...r, ret_role_name: newRole } : r));

        const res = await updateRelationshipAction(tenantId, relId, newRole);
        if (res.error) {
            toast.error(res.error || "Failed to update role");
            // Revert
            if (oldRel) {
                setRelationships(prev => prev.map(r => r.relationshipId === relId ? oldRel : r));
            }
        } else {
            toast.success("Role updated");
        }
    };

    const handleDeleteRelationship = async (relId: string) => {
        // Optimistic
        const oldList = [...relationships];
        setRelationships(prev => prev.filter(r => r.relationshipId !== relId));

        const res = await removeRelationshipAction(tenantId, relId);
        if (res.error) {
            toast.error("Failed to remove relationship");
            setRelationships(oldList); // Revert
        } else {
            toast.success("Relationship removed");
        }
    };


    // Map full profile to GenericEntity for EntityCard
    const mapToGenericEntity = (p: any) => ({
        id: p.ret_id,
        displayName: p.ret_name,
        type: p.type || p.ret_type || 'person',
        status: p.ret_status,
        email: p.email,
        phone: p.phone,
        // industry: p.ret_role_name // Using Industry field for Role in Generic Card for now?
        // Or generic card needs role support. EntityCard displays 'industry' or 'type'.
        // Let's force type to Role Name for display purposes if industry is missing.
        industry: p.ret_role_name
    });

    const handlePersonClick = (id: string) => {
        const entity = relationships.find(r => (r.ret_id || r.id) === id);
        if (entity && entity.type === 'organization') {
            window.location.href = `/dashboard/organizations/${id}`;
        } else {
            window.location.href = `/dashboard/people/${id}`;
        }
    };

    const handleEdit = (rel: any) => {
        setSelectedEntity({ id: rel.target?.id || rel.ret_id, name: rel.target?.name || rel.ret_name });
        setMetadata({
            jobTitle: rel.metadata?.jobTitle || rel.ret_role_name || '',
            startDate: rel.metadata?.startDate || ''
        });
        setSelectedType(rel.relationshipType?.name || rel.ret_role_name || 'partner'); // Try to guess or use saved type
        setEditingRel(rel);
        setIsAdding(true);
    };

    // Dynamic Label Helper
    const getRoleLabel = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('partner')) return 'Role / Description';
        if (t.includes('investor')) return 'Investment Focus / Role';
        return 'Job Title';
    };

    return (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-primary" />
                        Relationships
                        <span className="ml-1 text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{relationships.length}</span>
                    </h3>

                    {/* View Switcher */}
                    <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/50">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                viewMode === 'list' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="List View"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                viewMode === 'cards' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Cards View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('tags')}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                viewMode === 'tags' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Tags View"
                        >
                            <Tags className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => { setIsAdding(!isAdding); setEditingRel(null); setSelectedEntity(null); }}
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                    {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {isAdding ? "Cancel" : "Add"}
                </button>
            </div>

            {isAdding && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            {editingRel ? <Pencil className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                            {editingRel ? 'Edit Relationship' : (entityType === 'organization' ? 'Link Person' : 'Link Entity')}
                        </div>
                        {selectedType && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                                {selectedType}
                            </span>
                        )}
                    </div>

                    {!selectedEntity ? (
                        <div className="flex gap-2 flex-col">
                            <EntityPicker
                                tenantId={tenantId}
                                onChange={handleInitialSelect}
                                excludeIds={[entityId, ...relationships.map(r => r.ret_id)]}
                                placeholder="Type name to search / create..."
                            />
                            {/* Type Selector  */}
                            <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                                {availableTypes.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setSelectedType(t)}
                                        className={cn(
                                            "px-2 py-1 text-[10px] rounded-full border transition-colors whitespace-nowrap",
                                            selectedType === t
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Adding: {selectedEntity.name}</span>
                                {!editingRel && <button onClick={() => setSelectedEntity(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground font-semibold">{getRoleLabel(selectedType)}</label>
                                    <input
                                        className="w-full text-sm bg-background border border-border rounded-md px-2 py-1"
                                        placeholder={getRoleLabel(selectedType)}
                                        value={metadata.jobTitle}
                                        onChange={e => setMetadata(prev => ({ ...prev, jobTitle: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground font-semibold">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full text-sm bg-background border border-border rounded-md px-2 py-1"
                                        value={metadata.startDate}
                                        onChange={e => setMetadata(prev => ({ ...prev, startDate: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={handleCancelAdd}
                                    className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmAdd}
                                    className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90"
                                >
                                    {editingRel ? 'Save Changes' : 'Confirm Link'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="w-full min-h-[200px]">
                {loading && relationships.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                        <span className="text-sm">Loading connections...</span>
                    </div>
                ) : relationships.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border/50 rounded-lg">
                        No relationships linked yet.
                    </div>
                ) : (
                    <>
                        {viewMode === 'list' && (
                            <SimplePeopleTable
                                people={relationships}
                                loading={false}
                                hasMore={false}
                                loadMore={() => { }}
                                onPersonClick={handlePersonClick}
                                highlightId={null}
                                tenantId={tenantId}
                                statusOptions={statusOptions}
                                onUpdateRole={handleUpdateRole}
                                onDeleteRelationship={handleDeleteRelationship}
                                onEditRelationship={(relId) => {
                                    const rel = relationships.find(r => r.relationshipId === relId);
                                    if (rel) handleEdit(rel);
                                }}
                            />
                        )}

                        {viewMode === 'cards' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {relationships.map(p => (
                                    <EntityCard
                                        key={p.ret_id}
                                        entity={mapToGenericEntity(p)}
                                        tenantId={tenantId}
                                        onEdit={() => handleEdit(p)}
                                        onNavigate={() => handlePersonClick(p.ret_id || p.id)}
                                        onDelete={() => handleDeleteRelationship(p.relationshipId)}
                                    // TODO: Add Unlink action to Card context menu if possible
                                    />
                                ))}
                            </div>
                        )}

                        {viewMode === 'tags' && (
                            <PeopleTags
                                people={relationships}
                                loading={false}
                                hasMore={false}
                                loadMore={() => { }}
                                tenantId={tenantId}
                                onPersonClick={handlePersonClick}
                                highlightId={null}
                                onEdit={(p) => handleEdit(p)}
                                onDelete={(id) => handleDeleteRelationship(id)}
                            />
                        )}
                    </>
                )}
            </div>

        </div>
    );
}
