// EntityViewLayout.tsx — The main layout container for entity views.
// Consumes EntityViewConfig<T> via config prop (from useEntityView hook).
// Preserves our existing Tailwind UI: SmartChip, SavedViewsMenu, AddFilterCommand, search history.

"use client";

import React, { useState, useRef, useCallback } from "react";
import {
    LayoutGrid,
    List,
    CreditCard,
    MoreHorizontal,
    RotateCcw,
    Download,
    Database,
    Search,
    X,
    Filter,
    ChevronDown,
    History,
    CheckSquare,
    XCircle,
    GitBranch,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import SavedViewsMenu from "@/components/SavedViewsMenu";
import SmartChip from "@/components/universal/SmartChip";
import AddFilterCommand from "@/components/universal/AddFilterCommand";
import { EntityViewLayoutProps, ViewMode, GridRenderProps, CardsRenderProps, TagsRenderProps, TreeRenderProps } from "./types";
import { EntityAgGrid } from "./EntityAgGrid";
import { EntityTreeGrid } from "./EntityTreeGrid";
import { BomTreeView } from "./BomTreeView";

// ==================== Responsive Mobile Menu ====================

function ResponsiveActionsMenu<T>({
    config,
    availableViewModes,
}: {
    config: EntityViewLayoutProps<T>["config"];
    availableViewModes: ViewMode[];
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button className="p-2 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-48 p-2 bg-popover text-popover-foreground rounded-xl border border-border shadow-lg animate-in fade-in zoom-in-95"
                    align="end"
                    sideOffset={5}
                >
                    <div className="mb-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">View Mode</div>
                        <div className="flex bg-secondary/30 p-1 rounded-lg border border-border/50 gap-1">
                            {availableViewModes.includes("tags") && (
                                <button
                                    onClick={() => { config.setViewMode("tags"); setOpen(false); }}
                                    className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${config.viewMode === "tags" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("grid") && (
                                <button
                                    onClick={() => { config.setViewMode("grid"); setOpen(false); }}
                                    className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${config.viewMode === "grid" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("cards") && (
                                <button
                                    onClick={() => { config.setViewMode("cards"); setOpen(false); }}
                                    className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${config.viewMode === "cards" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                                >
                                    <CreditCard className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("tree") && (
                                <button
                                    onClick={() => { config.setViewMode("tree"); setOpen(false); }}
                                    className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${config.viewMode === "tree" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
                                >
                                    <GitBranch className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-border/50 pt-2 px-1">
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Results:</span>
                            <span className="font-medium text-foreground">
                                {config.filteredData.length.toLocaleString()} / {(config.pagination.totalRecords ?? config.filteredData.length).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

// ==================== Main Layout Component ====================

export default function EntityViewLayout<T = any>({
    title,
    entityType,
    columns = [],
    tenantId,
    config,
    onRowClick,
    onRowDoubleClick,
    onSelectionChange,
    customActions,
    enableExport = false,
    enableImport = false,
    enableBulkActions = true,
    onExport,
    onDebugSql,
    availableViewModes = ["tags", "grid", "cards"],
    defaultViewMode = "tags",
    renderGrid,
    renderCards,
    renderTags,
    renderTree,
    availableFilters,
    filterOptions = {},
    savedViews = [],
    searchHistory = [],
    onAddHistory,
    onClearHistory,
    maxHistoryItems = 5,
    className = "",
}: EntityViewLayoutProps<T>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Filtered search history
    const filteredHistory = config.searchTerm
        ? searchHistory.filter((h) => h.toLowerCase().includes(config.searchTerm.toLowerCase()))
        : searchHistory;

    const totalCount = config.pagination.totalRecords ?? config.filteredData.length;
    const filteredCount = config.filteredData.length;

    // ---- Render the active view ----
    // Simple inline rendering - no useCallback/useMemo to avoid dependency hell
    const renderCurrentView = () => {
        const commonProps = {
            data: config.filteredData,
            loading: config.loading,
            selectedIds: config.selectedIds,
        };


        switch (config.viewMode) {
            case "grid":
                if (renderGrid) {
                    return renderGrid({
                        ...commonProps,
                        columns,
                        sorting: config.sorting,
                        pagination: config.pagination,
                        onRowClick,
                        onSelectionChange: config.setSelectedIds,
                        onSortChange: config.setSorting,
                        onPaginationChange: config.setPagination,
                    });
                }
                // Default: use EntityAgGrid
                return (
                    <EntityAgGrid
                        {...commonProps}
                        columns={columns}
                        sorting={config.sorting}
                        pagination={config.pagination}
                        onRowClick={onRowClick}
                        onSelectionChange={config.setSelectedIds}
                        onSortChange={config.setSorting}
                        onPaginationChange={config.setPagination}
                    />
                );

            case "cards":
                if (renderCards) {
                    return renderCards({
                        ...commonProps,
                        onCardClick: onRowClick,
                        onSelectionChange: config.setSelectedIds,
                        renderCard: (item, selected) => (
                            <div className="p-4 border border-border rounded-lg bg-card">
                                Default Card — implement renderCards prop
                            </div>
                        ),
                    });
                }
                return (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                        Cards view — implement renderCards prop
                    </div>
                );

            case "tags":
                if (renderTags) {
                    return renderTags({
                        ...commonProps,
                        onTagClick: onRowClick,
                    });
                }
                return (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                        Tags view — implement renderTags prop
                    </div>
                );

            case "tree":
                if (renderTree) {
                    return renderTree({
                        ...commonProps,
                        onRowClick,
                        onSelectionChange: config.setSelectedIds,
                        getDataPath: (item: any) => [],
                        autoGroupColumnDef: undefined,
                    });
                }
                // Use custom BomTreeView for proper parent node display
                return (
                    <BomTreeView
                        data={config.filteredData}
                        columns={columns}
                        getItemId={(item: any) => String(item.item_id || item.id)}
                        getLevel={(item: any) => item.level || 0}
                        getPath={(item: any) => item.path || item.name || ''}
                        onRowClick={onRowClick}
                        selectedIds={config.selectedIds}
                        className="flex-1"
                    />
                );

            default:
                if (renderTags) return renderTags({ ...commonProps, onTagClick: onRowClick });
                return null;
        }
    };

    return (
        <div className={`flex flex-col gap-4 w-full h-full ${className}`}>
            {/* ==================== Toolbar ==================== */}
            <div className="flex flex-col gap-2 sticky top-0 z-30 pb-2">
                {/* Top Row: Stats & Actions */}
                <div className="flex items-center justify-between w-full">
                    {/* Left: Stats */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-foreground tabular-nums">
                                {(filteredCount === 0 && !config.loading && totalCount > 0) ? "0" : filteredCount.toLocaleString()}
                                <span className="text-muted-foreground font-normal mx-1">/</span>
                                {totalCount.toLocaleString()}
                            </span>

                            <button
                                onClick={() => config.refresh(true)}
                                disabled={config.loading}
                                className="group flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/30 hover:bg-secondary border border-transparent hover:border-border transition-all disabled:opacity-50"
                            >
                                <RotateCcw className={`w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ${config.loading ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Custom Actions */}
                        {customActions}

                        {/* Export Button */}
                        {enableExport && onExport && (
                            <button
                                onClick={onExport}
                                className="p-2 text-muted-foreground hover:text-primary transition-colors hidden md:block"
                                title="Export CSV"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        )}

                        {/* Debug SQL Button */}
                        {onDebugSql && (
                            <button
                                onClick={onDebugSql}
                                className="p-2 text-muted-foreground hover:text-primary transition-colors hidden md:block"
                                title="Generate Debug SQL"
                            >
                                <Database className="w-4 h-4" />
                            </button>
                        )}

                        <div className="h-6 w-px bg-border/50 mx-1 hidden md:block" />

                        {/* View Switcher (Desktop) */}
                        <div className="hidden md:flex bg-secondary/50 p-1 rounded-lg border border-border/50">
                            {availableViewModes.includes("tags") && (
                                <button
                                    onClick={() => config.setViewMode("tags")}
                                    className={`p-1.5 rounded-md transition-all ${config.viewMode === "tags" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("grid") && (
                                <button
                                    onClick={() => config.setViewMode("grid")}
                                    className={`p-1.5 rounded-md transition-all ${config.viewMode === "grid" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("cards") && (
                                <button
                                    onClick={() => config.setViewMode("cards")}
                                    className={`p-1.5 rounded-md transition-all ${config.viewMode === "cards" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                >
                                    <CreditCard className="w-4 h-4" />
                                </button>
                            )}
                            {availableViewModes.includes("tree") && (
                                <button
                                    onClick={() => config.setViewMode("tree")}
                                    className={`p-1.5 rounded-md transition-all ${config.viewMode === "tree" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                >
                                    <GitBranch className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Mobile Actions */}
                        <div className="md:hidden">
                            <ResponsiveActionsMenu config={config} availableViewModes={availableViewModes} />
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Search & Filters */}
                <div
                    className="flex flex-wrap items-center gap-2 w-full bg-secondary/50 border border-border rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:bg-background transition-all"
                    onClick={() => inputRef.current?.focus()}
                >
                    {/* Saved View Chip */}
                    <div
                        className={`
              group flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border transition-all select-none mr-1
              ${config.activeSavedView
                                ? "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                : "bg-secondary/30 border-transparent hover:bg-secondary/50 hover:border-border text-muted-foreground"
                            }
            `}
                    >
                        <SavedViewsMenu
                            tenantId={tenantId}
                            configOverride={{
                                filters: config.filters,
                                sorting: config.sorting,
                                viewMode: config.viewMode,
                                searchTerm: config.searchTerm,
                                restoreState: config.restoreState,
                            }}
                            trigger={
                                <button className="flex items-center gap-1.5 text-xs font-medium px-1 outline-none">
                                    {config.activeSavedView ? (
                                        <>
                                            <span className="opacity-70 uppercase tracking-wider text-[10px]">View:</span>
                                            <span className="font-bold truncate max-w-[100px]">{config.activeSavedView.name}</span>
                                            {config.isModified && <span className="text-xs opacity-70" title="Unsaved changes">*</span>}
                                        </>
                                    ) : (
                                        <Filter className="w-3.5 h-3.5 opacity-70" />
                                    )}
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                            }
                        />
                        {config.activeSavedView && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    config.restoreState({ filters: [], sorting: [], viewMode: "tags" as ViewMode, searchTerm: "" });
                                }}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors ml-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Search Input */}
                    <div
                        className={`
              group flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border transition-all mr-1 relative
              ${config.searchTerm
                                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                                : "bg-background border-border hover:border-primary/50 text-muted-foreground focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
                            }
            `}
                    >
                        <Search className={`w-3.5 h-3.5 shrink-0 ${config.searchTerm ? "opacity-70" : "opacity-50"}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type to search..."
                            className="bg-transparent outline-none text-xs font-medium placeholder:text-muted-foreground/50 min-w-[100px] w-auto max-w-[200px]"
                            value={config.searchTerm}
                            onChange={(e) => config.setSearchTerm(e.target.value)}
                            onFocus={() => setShowHistory(true)}
                            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && onAddHistory) {
                                    onAddHistory(config.searchTerm);
                                    setShowHistory(false);
                                }
                            }}
                        />
                        {config.searchTerm && (
                            <button
                                onClick={() => {
                                    config.setSearchTerm("");
                                    inputRef.current?.focus();
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors shrink-0 cursor-pointer"
                                title="Clear Search"
                            >
                                <X className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                            </button>
                        )}

                        {/* Recent Searches Dropdown */}
                        {showHistory && filteredHistory.length > 0 && onAddHistory && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-[300px] bg-popover text-popover-foreground rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[300px]">
                                <div className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-3 py-2 flex justify-between items-center bg-popover/95 backdrop-blur-sm z-10 border-b shrink-0">
                                    <span>{config.searchTerm ? "SUGGESTIONS" : "RECENT SEARCHES"}</span>
                                    {!config.searchTerm && onClearHistory && (
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); onClearHistory(); }}
                                            className="hover:text-destructive transition-colors"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col overflow-y-auto">
                                    {filteredHistory.map((term, i) => (
                                        <button
                                            key={i}
                                            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50 text-left transition-colors group/item border-b border-border/30 last:border-0"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                config.setSearchTerm(term);
                                                onAddHistory(term);
                                                setShowHistory(false);
                                            }}
                                        >
                                            <History className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/item:text-primary/50 shrink-0" />
                                            <span className="truncate">{term}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter Chips (SmartChip) */}
                    {config.filters.map((filter) => (
                        <SmartChip
                            key={filter.id}
                            filter={filter as any}
                            onUpdate={(updates) => config.updateFilter(filter.id, updates as any)}
                            onRemove={() => config.removeFilter(filter.id)}
                            dynamicOptions={filterOptions}
                        />
                    ))}

                    {/* Add Filter Trigger */}
                    {availableFilters && (
                        <AddFilterCommand
                            minimal={true}
                            fields={availableFilters}
                            onSelectField={(field) => {
                                if (field === "search") {
                                    setIsSearchOpen(true);
                                } else {
                                    config.addFilter({
                                        id: `new_${field}_${Date.now()}`,
                                        field,
                                        operator: "equals",
                                        value: "",
                                        isEnabled: true,
                                        defaultOpen: true,
                                    });
                                }
                            }}
                        />
                    )}
                </div>
            </div>

            {/* ==================== Bulk Actions Bar ==================== */}
            {
                enableBulkActions && config.selectedIds.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl animate-in slide-in-from-top-2">
                        <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                            {config.selectedIds.length} נבחרו
                        </span>
                        <button
                            onClick={config.clearSelection}
                            className="text-xs px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors flex items-center gap-1"
                        >
                            <XCircle className="w-3 h-3" />
                            בטל בחירה
                        </button>
                    </div>
                )
            }

            {/* ==================== Error State ==================== */}
            {
                config.error && (
                    <div className="flex flex-col items-center justify-center py-12 text-destructive gap-3">
                        <p className="text-sm font-medium">שגיאה: {config.error.message}</p>
                        <button
                            onClick={() => config.refresh()}
                            className="px-4 py-2 text-sm rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors"
                        >
                            נסה שוב
                        </button>
                    </div>
                )
            }

            {/* ==================== Content Area ==================== */}
            {
                !config.error && (
                    <div className="transition-all duration-300 flex-1 min-h-0 flex flex-col">
                        {renderCurrentView()}
                    </div>
                )
            }
        </div >
    );
}
