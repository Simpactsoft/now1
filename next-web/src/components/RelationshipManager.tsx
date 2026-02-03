
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import EntityPicker from "@/components/universal/EntityPicker";
import { Plus, X, Link as LinkIcon, Briefcase, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addRelationshipAction, removeRelationshipAction, fetchRelationshipsAction, updateRelationshipAction } from "@/app/actions/relationships";

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

export default function RelationshipManager({ tenantId, entityId, entityType }: RelationshipManagerProps) {
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Edit State
    const [editingRelId, setEditingRelId] = useState<string | null>(null);

    // Configurable Types State (TODO: Fetch from config)
    const [selectedType, setSelectedType] = useState("Employee");

    const availableTypes = ['Employee', 'Manager', 'Partner', 'Supplier', 'Investor', 'Board Member'];

    useEffect(() => {
        loadRelationships();
    }, [entityId]);

    const loadRelationships = async () => {
        setLoading(true);
        const res = await fetchRelationshipsAction(tenantId, entityId);
        if (res.error) {
            console.error(res.error);
        } else {
            setRelationships(res.data || []);
        }
        setLoading(false);
    };

    const handleAdd = async (entity: any) => {
        if (!entity) return;

        try {
            // Optimistic Update
            const tempId = Math.random().toString();
            const newRel: Relationship = {
                id: tempId,
                target: { id: entity.id, name: entity.name, type: entity.type },
                type: { id: 'temp', name: selectedType }
            };
            setRelationships(prev => [...prev, newRel]);
            setIsAdding(false);

            const res = await addRelationshipAction(tenantId, entityId, entity.id, selectedType);

            if (res.error) {
                toast.error(res.error);
                setRelationships(prev => prev.filter(r => r.id !== tempId)); // Revert
            } else {
                toast.success("Relationship linked");
                loadRelationships(); // Refresh for real ID
            }
        } catch (e) {
            toast.error("Failed to link");
        }
    };

    const handleRemove = async (relId: string) => {
        const confirm = window.confirm("Unlink this relationship?");
        if (!confirm) return;

        setRelationships(prev => prev.filter(r => r.id !== relId));
        await removeRelationshipAction(relId);
        toast.success("Unlinked");
    };

    const handleUpdateType = async (relId: string, newType: string) => {
        // Optimistic
        const originalrels = [...relationships];
        setRelationships(prev => prev.map(r => r.id === relId ? { ...r, type: { ...r.type, name: newType } } : r));
        setEditingRelId(null);

        try {
            const res = await updateRelationshipAction(tenantId, relId, newType);
            if (res.error) {
                toast.error(res.error);
                setRelationships(originalrels); // Revert
            } else {
                toast.success("Updated");
            }
        } catch (e) {
            setRelationships(originalrels);
            toast.error("Failed to update");
        }
    };

    return (
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-primary" />
                    Relationships
                </h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                    {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {isAdding ? "Cancel" : "Add"}
                </button>
            </div>

            {isAdding && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Link {entityType === 'organization' ? 'Person' : 'Entity'}</div>
                    <div className="flex gap-2 flex-col">
                        <EntityPicker
                            tenantId={tenantId}
                            onChange={handleAdd}
                            excludeIds={[entityId, ...relationships.map(r => r.target.id)]}
                            placeholder="Find person or company..."
                        />
                        {/* Type Selector (Simple for now) */}
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
                </div>
            )}

            <div className="space-y-3">
                {loading ? (
                    <div className="text-xs text-muted-foreground animate-pulse">Loading connections...</div>
                ) : relationships.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-lg">
                        No relationships linked yet.
                    </div>
                ) : (
                    relationships.map(rel => (
                        <div key={rel.id} className="group flex flex-col p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                            <div className="flex items-center justify-between">
                                <Link
                                    href={`/dashboard/${rel.target.type === 'person' ? 'people' : 'organizations'}/${rel.target.id}`}
                                    className="flex items-center gap-3 overflow-hidden flex-1 hover:opacity-80 transition-opacity"
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                        rel.target.type === 'person' ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-purple-50 border-purple-100 text-purple-600"
                                    )}>
                                        {rel.target.type === 'person' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium truncate text-foreground hover:underline decoration-primary/50 underline-offset-2">{rel.target.name}</span>
                                        {editingRelId !== rel.id && (
                                            <span
                                                className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingRelId(rel.id); }}
                                                title="Click to edit type"
                                            >
                                                <Briefcase className="w-3 h-3" /> {rel.type.name}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                <button
                                    onClick={() => handleRemove(rel.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                                    title="Unlink"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Inline Edit UI */}
                            {editingRelId === rel.id && (
                                <div className="mt-2 pl-11 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex flex-wrap gap-1">
                                        {availableTypes.map(t => (
                                            <button
                                                key={t}
                                                onClick={() => handleUpdateType(rel.id, t)}
                                                className={cn(
                                                    "px-2 py-0.5 text-[10px] rounded-full border transition-colors",
                                                    rel.type.name === t
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-accent"
                                                )}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setEditingRelId(null)}
                                            className="px-2 py-0.5 text-[10px] rounded-full text-muted-foreground hover:bg-muted"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
