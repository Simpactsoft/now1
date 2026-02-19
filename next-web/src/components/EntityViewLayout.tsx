"use client";

import { useState, useRef } from "react";
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
    Settings
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useViewConfig } from "@/components/universal/ViewConfigContext";
import SavedViewsMenu from "@/components/SavedViewsMenu";
import SmartChip from "@/components/universal/SmartChip";
import AddFilterCommand from "@/components/universal/AddFilterCommand";
import { toast } from "sonner";

// --- Props Interface ---
interface EntityViewLayoutProps {
    tenantId: string;
    // Stats
    totalCount: number;
    filteredCount: number;
    lastRefreshed: Date | null;
    loading: boolean;
    // Actions
    onRefresh: (reset?: boolean) => void;
    onExport?: () => void;
    canExport?: boolean;
    // Search History Params (Optional, if the entity supports history)
    searchHistory?: string[];
    onAddHistory?: (term: string) => void;
    onClearHistory?: () => void;
    // Dynamic Options for Filters (e.g. Statuses)
    filterOptions?: Record<string, any[]>;
    // Available Filters Configuration
    availableFilters?: { id: string; label: string; icon: any }[];
    // Render Props for Views
    renderTags: () => React.ReactNode;
    renderGrid: () => React.ReactNode;
    renderCards: () => React.ReactNode;
    renderConfigurations?: () => React.ReactNode; // NEW: Optional configurations view
    // Debug
    onDebugSql?: () => void;
}

// --- Responsive Menu Component ---
function ResponsiveActionsMenu({ viewMode, dispatch, total, filtered }: { viewMode: string, dispatch: any, total: number, filtered: number }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button className="p-2 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content className="z-50 w-48 p-2 bg-popover text-popover-foreground rounded-xl border border-border shadow-lg animate-in fade-in zoom-in-95" align="end" sideOffset={5}>
                    {/* View Switcher Mobile */}
                    <div className="mb-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">View Mode</div>
                        <div className="flex bg-secondary/30 p-1 rounded-lg border border-border/50 gap-1">
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'tags' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'tags' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <List className="w-4 h-4" />
                            </button>
                            <button onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'cards' }); setOpen(false); }} className={`flex-1 p-1.5 rounded-md flex justify-center transition-all ${viewMode === 'cards' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
                                <CreditCard className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-border/50 pt-2 px-1">
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Results:</span>
                            <span className="font-medium text-foreground">{filtered.toLocaleString()} / {total.toLocaleString()}</span>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

// --- Main Layout Component ---
export default function EntityViewLayout({
    tenantId,
    totalCount,
    filteredCount,
    lastRefreshed,
    loading,
    onRefresh,
    onExport,
    canExport,
    searchHistory = [],
    onAddHistory,
    onClearHistory,
    filterOptions = {},
    availableFilters,
    renderTags,
    renderGrid,
    renderCards,
    renderConfigurations, // NEW
    onDebugSql
}: EntityViewLayoutProps) {
    const { viewMode, filters, sort, dispatch, searchTerm, activeSavedView, isModified } = useViewConfig();
    const inputRef = useRef<HTMLInputElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Filter History Display Logic
    const filteredHistory = searchTerm
        ? searchHistory.filter(h => h.toLowerCase().includes(searchTerm.toLowerCase()))
        : searchHistory;

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            {/* Standard Toolbar */}
            <div className="flex flex-col gap-2 bg-card/50 p-3 rounded-2xl border border-border backdrop-blur-sm shadow-sm sticky top-0 z-30">

                {/* Top Row: Stats & Actions */}
                <div className="flex items-center justify-between w-full">
                    {/* Left: Stats */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-foreground tabular-nums">
                                {(filteredCount === 0 && !loading && totalCount > 0) ? '0' : filteredCount.toLocaleString()}
                                <span className="text-muted-foreground font-normal mx-1">/</span>
                                {totalCount.toLocaleString()}
                            </span>

                            <button
                                onClick={() => onRefresh(true)}
                                disabled={loading}
                                className="group flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/30 hover:bg-secondary border border-transparent hover:border-border transition-all disabled:opacity-50"
                                title={lastRefreshed ? `Last updated: ${lastRefreshed.toLocaleTimeString()}` : ''}
                                suppressHydrationWarning
                            >
                                <RotateCcw className={`w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`} />
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline-block" suppressHydrationWarning>
                                    {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Export Button */}
                        {canExport && onExport && (
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
                                className="p-2 text-muted-foreground hover:text-primary transition-colors hidden md:block" // Hidden on mobile
                                title="Generate Debug SQL"
                            >
                                <Database className="w-4 h-4" />
                            </button>
                        )}

                        <div className="h-6 w-px bg-border/50 mx-1 hidden md:block"></div>

                        {/* View Switcher (Desktop) */}
                        <div className="hidden md:flex bg-secondary/50 p-1 rounded-lg border border-border/50">
                            <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'tags' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'tags' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                <List className="w-4 h-4" />
                            </button>
                            <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'cards' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                <CreditCard className="w-4 h-4" />
                            </button>
                            {renderConfigurations && (
                                <button onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'configurations' })} className={`p-1.5 rounded-md transition-all ${viewMode === 'configurations' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Settings className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Mobile Actions/More */}
                        <div className="md:hidden">
                            <ResponsiveActionsMenu
                                viewMode={viewMode}
                                dispatch={dispatch}
                                total={totalCount}
                                filtered={filteredCount}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Search & Filters */}
                <div
                    className="flex flex-wrap items-center gap-2 w-full bg-secondary/50 border border-border rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:bg-background transition-all"
                    onClick={() => inputRef.current?.focus()}
                >
                    {/* Saved View Chip */}
                    <div className={`
                        group flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border transition-all select-none mr-1
                        ${activeSavedView
                            ? 'bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-secondary/30 border-transparent hover:bg-secondary/50 hover:border-border text-muted-foreground'}
                    `}>
                        <SavedViewsMenu
                            tenantId={tenantId}
                            configOverride={{
                                filters,
                                sort,
                                viewMode,
                                searchTerm,
                                dispatch,
                            }}
                            trigger={
                                <button className="flex items-center gap-1.5 text-xs font-medium px-1 outline-none">
                                    {activeSavedView ? (
                                        <>
                                            <span className="opacity-70 uppercase tracking-wider text-[10px]">View:</span>
                                            <span className="font-bold truncate max-w-[100px]">{activeSavedView.name}</span>
                                            {isModified && <span className="text-xs opacity-70" title="Unsaved changes">*</span>}
                                        </>
                                    ) : (
                                        <Filter className="w-3.5 h-3.5 opacity-70" />
                                    )}
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                            }
                        />
                        {activeSavedView && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({
                                        type: 'RESTORE_STATE',
                                        payload: { filters: [], sort: [], viewMode: 'tags', searchTerm: '' }
                                    });
                                }}
                                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition-colors ml-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className={`
                        group flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border transition-all mr-1 relative
                        ${searchTerm
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-background border-border hover:border-primary/50 text-muted-foreground focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10'}
                    `}>
                        <Search className={`w-3.5 h-3.5 shrink-0 ${searchTerm ? 'opacity-70' : 'opacity-50'}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type to search..."
                            className="bg-transparent outline-none text-xs font-medium placeholder:text-muted-foreground/50 min-w-[100px] w-auto max-w-[200px]"
                            value={searchTerm}
                            onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', payload: e.target.value })}
                            onFocus={() => setShowHistory(true)}
                            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && onAddHistory) {
                                    onAddHistory(searchTerm);
                                    setShowHistory(false);
                                }
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    dispatch({ type: 'SET_SEARCH_TERM', payload: '' });
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
                                    <span>{searchTerm ? 'SUGGESTIONS' : 'RECENT SEARCHES'}</span>
                                    {!searchTerm && onClearHistory && (
                                        <button onMouseDown={(e) => { e.preventDefault(); onClearHistory(); }} className="hover:text-destructive transition-colors">Clear All</button>
                                    )}
                                </div>
                                <div className="flex flex-col overflow-y-auto">
                                    {filteredHistory.map((term, i) => (
                                        <button
                                            key={i}
                                            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50 text-left transition-colors group/item border-b border-border/30 last:border-0"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                dispatch({ type: 'SET_SEARCH_TERM', payload: term });
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

                    {/* Filter Chips */}
                    {filters.map((filter) => (
                        <SmartChip
                            key={filter.id}
                            filter={filter}
                            onUpdate={(updates) => dispatch({ type: 'UPDATE_FILTER', payload: { id: filter.id, updates } })}
                            onRemove={() => dispatch({ type: 'REMOVE_FILTER', payload: filter.id })}
                            dynamicOptions={filterOptions}
                        />
                    ))}

                    {/* Add Filter Trigger */}
                    <AddFilterCommand
                        minimal={true}
                        fields={availableFilters}
                        onSelectField={(field) => {
                            if (field === 'search') {
                                setIsSearchOpen(true);
                            } else {
                                dispatch({
                                    type: 'ADD_FILTER',
                                    payload: {
                                        id: `new_${field}_${Date.now()}`,
                                        field,
                                        operator: 'equals',
                                        value: '',
                                        isEnabled: true,
                                        defaultOpen: true
                                    }
                                });
                            }
                        }}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className={`transition-all duration-300 min-h-[100px]`}>
                {viewMode === 'tags' && renderTags()}
                {viewMode === 'grid' && renderGrid()}
                {viewMode === 'cards' && renderCards()}
                {viewMode === 'configurations' && renderConfigurations && renderConfigurations()}
            </div>
        </div>
    );
}
