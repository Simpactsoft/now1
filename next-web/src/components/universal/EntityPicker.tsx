
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, User, Building2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import PersonFormDialog from "@/components/PersonFormDialog";
// Custom imports
import OrganizationFormDialog from "@/components/OrganizationFormDialog";

interface Entity {
    id: string;
    name: string;
    type: 'person' | 'organization';
    avatarUrl?: string;
    details?: string; // e.g. "CEO at Acme" or "Software Company"
}

interface EntityPickerProps {
    tenantId: string;
    value?: Entity | null;
    onChange: (entity: Entity | null) => void;
    placeholder?: string;
    excludeIds?: string[]; // IDs to hide (e.g. self)
}

export default function EntityPicker({
    tenantId,
    value,
    onChange,
    placeholder = "Search people or organizations...",
    excludeIds = []
}: EntityPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [results, setResults] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(false);

    // Create New state
    const [showCreatePerson, setShowCreatePerson] = useState(false);
    const [showCreateOrg, setShowCreateOrg] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const search = async () => {
            setLoading(true);
            try {
                // Fetch from API route which we'll create next
                const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}&tenantId=${tenantId}`);
                const data = await res.json();

                // Filter excludes
                const filtered = (data.results || []).filter((e: Entity) => !excludeIds.includes(e.id));
                setResults(filtered);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setLoading(false);
            }
        };

        search();
    }, [debouncedSearch, isOpen, tenantId]);  // Intentionally excludes excludeIds to avoid refetch loop

    const handleSelect = (entity: Entity) => {
        onChange(entity);
        setIsOpen(false);
        setSearchTerm(""); // Reset
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    };

    return (
        <div className="relative w-full">
            {/* Trigger Area */}
            <div
                className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md cursor-pointer transition-colors bg-white hover:bg-muted/10",
                    value ? "border-primary/50 bg-primary/5" : "border-input"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {value ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shrink-0",
                            value.type === 'person' ? "bg-blue-500" : "bg-purple-500"
                        )}>
                            {value.type === 'person' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        </div>
                        <span className="font-medium truncate text-foreground">{value.name}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                )}

                {value ? (
                    <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                ) : (
                    <Search className="w-4 h-4 text-muted-foreground opacity-50" />
                )}
            </div>

            {/* Dropdown / Popover Implementation (Custom simplifed) */}
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-border rounded-md shadow-lg z-50 overflow-hidden flex flex-col max-h-[300px]">
                        <div className="p-2 border-b bg-muted/10">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                                placeholder="Type to search..."
                                value={searchTerm}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-1">
                            {loading ? (
                                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">Searching...</div>
                            ) : results.length > 0 ? (
                                results.map(entity => (
                                    <div
                                        key={entity.id}
                                        className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent/50 text-foreground"
                                        onClick={() => handleSelect(entity)}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                            entity.type === 'person' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                        )}>
                                            {entity.type === 'person' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                        </div>
                                        <div className="flex flex-col overflow-hidden text-left">
                                            <span className="text-sm font-medium truncate">{entity.name}</span>
                                            {entity.details && <span className="text-xs text-muted-foreground truncate">{entity.details}</span>}
                                        </div>
                                        {value?.id === entity.id && <Check className="w-4 h-4 ml-auto text-primary" />}
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                    {searchTerm ? "No results found." : "Start typing to search."}
                                </div>
                            )}
                        </div>

                        {/* Create New Actions */}
                        <div className="p-1 border-t bg-muted/20 flex gap-1">
                            <button
                                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-sm transition-colors"
                                onClick={(e) => { e.stopPropagation(); setShowCreatePerson(true); setIsOpen(false); }}
                            >
                                <Plus className="w-3 h-3" /> Person
                            </button>
                            <div className="w-px bg-border my-1" />
                            <button
                                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-purple-600 hover:bg-purple-500/10 rounded-sm transition-colors"
                                onClick={(e) => { e.stopPropagation(); setShowCreateOrg(true); setIsOpen(false); }}
                            >
                                <Plus className="w-3 h-3" /> Org
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Nested Create Dialogs */}
            <PersonFormDialog
                open={showCreatePerson}
                onOpenChange={setShowCreatePerson}
                tenantId={tenantId}
                defaultName={searchTerm}
                onSuccess={(res: any) => {
                    setShowCreatePerson(false);
                    // Handle both wrapped {data: {...}} and direct {...} responses
                    const id = res?.data?.id || res?.id;
                    const name = res?.data?.display_name || res?.display_name || res?.data?.firstName ? `${res?.data?.firstName} ${res?.data?.lastName}` : "";

                    if (id) {
                        const newEntity: Entity = {
                            id: id,
                            name: name || 'New Person',
                            type: 'person',
                            details: res?.data?.email || res?.email || 'Newly created'
                        };
                        onChange(newEntity);
                        setSearchTerm("");
                    }
                }}
                trigger={<></>}
            />

            <OrganizationFormDialog
                open={showCreateOrg}
                onOpenChange={setShowCreateOrg}
                tenantId={tenantId}
                defaultName={searchTerm}
                onSuccess={(res: any) => {
                    setShowCreateOrg(false);
                    // Handle both wrapped {data: {...}} and direct {...} responses from RPC
                    const id = res?.data?.id || res?.id;
                    const name = res?.data?.display_name || res?.display_name || res?.data?.name || res?.name;

                    if (id) {
                        const newEntity: Entity = {
                            id: id,
                            name: name || 'New Organization',
                            type: 'organization',
                            details: 'Newly created'
                        };
                        onChange(newEntity);
                        setSearchTerm("");
                    }
                }}
                trigger={<></>}
            />
        </div>
    );
}
