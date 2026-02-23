"use client";

import * as React from "react";
import { Bookmark, Save, Trash2, Edit2, Check, X, MoreHorizontal, Plus, ListFilter } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { getSavedViews, saveView, deleteView, renameView, SavedView } from "@/app/actions/savedViews";

interface SavedViewsMenuProps {
    tenantId: string;
    entityType?: string;
    minimal?: boolean;
    className?: string;
    trigger?: React.ReactNode;
    // Config values — injected by the parent (EntityViewLayout or legacy wrapper)
    configOverride?: {
        filters: any[];
        sort?: any[];
        sorting?: any[];
        viewMode: string;
        searchTerm: string;
        restoreState?: (state: any, savedView?: { id: string; name: string }) => void;
        dispatch?: (action: any) => void;
    };
}

export default function SavedViewsMenu({ tenantId, entityType, minimal = false, className = "", trigger, configOverride }: SavedViewsMenuProps) {
    const filters = configOverride?.filters ?? [];
    const sort = configOverride?.sort ?? configOverride?.sorting ?? [];
    const viewMode = configOverride?.viewMode ?? 'tags';
    const searchTerm = configOverride?.searchTerm ?? '';
    const dispatch = configOverride?.dispatch;
    const restoreState = configOverride?.restoreState;

    const [open, setOpen] = React.useState(false);
    const [views, setViews] = React.useState<SavedView[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [viewName, setViewName] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editName, setEditName] = React.useState("");

    // Load Views
    const loadViews = React.useCallback(async () => {
        setLoading(true);
        const res = await getSavedViews(tenantId, entityType);
        if (res.success && res.data) {
            setViews(res.data);
        }
        setLoading(false);
    }, [tenantId]);

    React.useEffect(() => {
        if (open) {
            loadViews();
        }
    }, [open, loadViews]);

    // Save New
    const handleSave = async () => {
        if (!viewName.trim()) return;
        setIsSaving(true);
        const config = {
            filters,
            sort,
            viewMode,
            searchTerm
        };
        const res = await saveView(tenantId, viewName, config, entityType || 'people');
        if (!res.success) {
            alert(res.error);
        } else {
            setViewName("");
            loadViews();
        }
        setIsSaving(false);
    };

    // Load View
    const handleSelect = (view: SavedView) => {
        const { config } = view;
        if (!config) return;

        if (restoreState) {
            restoreState(
                {
                    viewMode: config.viewMode,
                    sorting: config.sort,
                    filters: config.filters.map((f: any) => ({ ...f, defaultOpen: false })),
                    searchTerm: config.searchTerm || '',
                },
                { id: view.id, name: view.name }
            );
        } else if (dispatch) {
            dispatch({
                type: 'RESTORE_STATE',
                payload: {
                    viewMode: config.viewMode,
                    sort: config.sort,
                    filters: config.filters.map((f: any) => ({ ...f, defaultOpen: false })),
                    searchTerm: config.searchTerm || ''
                },
                savedView: { id: view.id, name: view.name }
            });
        }
        setOpen(false);
    };

    // Rename
    const handleRename = async (id: string) => {
        if (!editName.trim()) return;
        await renameView(id, editName);
        setEditingId(null);
        loadViews();
    };

    // Delete
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Delete this view?")) {
            await deleteView(id);
            loadViews();
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                {trigger ? trigger : (
                    minimal ? (
                        <button
                            className={`p-1 text-muted-foreground hover:text-primary transition-colors ${className}`}
                            title="Filter & Views"
                        >
                            <ListFilter className="w-4 h-4" />
                        </button>
                    ) : (
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors border border-transparent hover:border-border">
                            <Bookmark className="w-4 h-4" />
                            <span className="hidden sm:inline">Saved Views</span>
                        </button>
                    )
                )}
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content className="z-50 w-72 p-3 bg-popover text-popover-foreground rounded-xl border border-border shadow-lg animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95" sideOffset={5} align="end">

                    {/* Header: Save New */}
                    <div className="mb-4">
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Save Current View</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-background border border-input rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="View Name..."
                                value={viewName}
                                onChange={(e) => setViewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !viewName.trim()}
                                className="bg-primary text-primary-foreground p-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-border/50 my-2" />

                    {/* List */}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {loading && <div className="text-xs text-muted-foreground text-center py-2">Loading...</div>}
                        {!loading && views.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">No saved views</div>}

                        {views.map(view => (
                            <div
                                key={view.id}
                                className="group flex items-center justify-between p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border/50"
                                onClick={() => handleSelect(view)}
                            >
                                {editingId === view.id ? (
                                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            className="flex-1 min-w-0 bg-background border border-input rounded px-1 py-0.5 text-xs"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            autoFocus
                                        />
                                        <button onClick={() => handleRename(view.id)} className="text-green-500 hover:bg-green-500/10 p-1 rounded"><Check className="w-3 h-3" /></button>
                                        <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-red-500/10 p-1 rounded"><X className="w-3 h-3" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Bookmark className="w-3 h-3 text-primary/50" />
                                            <span className="text-sm truncate">{view.name}</span>
                                        </div>

                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingId(view.id); setEditName(view.name); }}
                                                className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(view.id, e)}
                                                className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
