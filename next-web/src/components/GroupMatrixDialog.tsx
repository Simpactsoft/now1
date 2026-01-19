"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchPeopleGrouped } from "@/app/actions/fetchPeopleGrouped";
import { LayoutGrid, Loader2, ArrowLeft, BarChart3, Tag, Briefcase, Building2, Calendar, X, Shapes } from "lucide-react";

interface GroupMatrixDialogProps {
    tenantId: string;
    onApplyFilter: (field: string, value: string) => void;
}

// User requested edits: Remove Industry, Ensure Status is prominent.
const DIMENSIONS = [
    { id: 'status', label: 'Status', icon: BarChart3, description: 'Filter by lead status' },
    { id: 'role_name', label: 'Role', icon: Briefcase, description: 'Filter by job role' },
    { id: 'company_size', label: 'Company Size', icon: Building2, description: 'Filter by employee count' },
    { id: 'joined_year', label: 'Year Joined', icon: Calendar, description: 'Filter by joining year' },
    { id: 'tags', label: 'Tags', icon: Tag, description: 'Filter by custom tags' },
];

export default function GroupMatrixDialog({ tenantId, onApplyFilter }: GroupMatrixDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
    const [activeDimension, setActiveDimension] = useState(DIMENSIONS[0]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Portal Support
    const [mounted, setMounted] = useState(false);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Toggle & Calculate Position
    const toggleOpen = () => {
        if (!isOpen) {
            // Opening
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setPopoverPos({
                    top: rect.bottom + window.scrollY + 8, // 8px vertical gap
                    left: rect.left + window.scrollX
                });
            }
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Click Outside Handling (Native Event on Document)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside the button (containerRef) or the popover (popoverRef)
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Also update position on scroll/resize ideally, but close on scroll might be better UX for simple implementations
            const handleScroll = () => setIsOpen(false);
            window.addEventListener('scroll', handleScroll, true);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('scroll', handleScroll, true);
            };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && viewMode === 'detail' && activeDimension) {
            loadGroups(activeDimension.id);
        }
    }, [isOpen, viewMode, activeDimension]);

    const loadGroups = async (field: string) => {
        setLoading(true);
        const res = await fetchPeopleGrouped(tenantId, field);
        if (res.groups) {
            setGroups(res.groups);
        }
        setLoading(false);
    };

    const handleDimensionSelect = (dim: typeof DIMENSIONS[0]) => {
        setActiveDimension(dim);
        setViewMode('detail');
    };

    const handleBack = () => {
        setViewMode('overview');
        setGroups([]);
    };

    const totalCount = groups.reduce((acc, g) => acc + Number(g.count), 0);

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all group ${isOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/80 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}
                title="Explore Groups"
            >
                <Shapes className="w-4 h-4" />
                <span className="hidden md:inline">Explore Groups</span>
            </button>

            {isOpen && mounted && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popoverRef}
                    style={{
                        top: popoverPos.top,
                        left: popoverPos.left,
                        position: 'absolute',
                        zIndex: 9999
                    }}
                    className="w-[600px] h-[500px] bg-popover border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                            {viewMode === 'detail' && (
                                <button
                                    onClick={handleBack}
                                    className="p-1 hover:bg-muted rounded-full mr-2 transition-colors"
                                    title="Back to Dimensions"
                                >
                                    <ArrowLeft className="w-4 h-4 text-foreground" />
                                </button>
                            )}
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                {viewMode === 'overview' ? (
                                    <>
                                        <LayoutGrid className="w-4 h-4 text-primary" />
                                        Explore Dimensions
                                    </>
                                ) : (
                                    <>
                                        <activeDimension.icon className="w-4 h-4 text-primary" />
                                        {activeDimension.label}
                                    </>
                                )}
                            </h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors text-muted-foreground"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 bg-background">
                        {viewMode === 'overview' ? (
                            <div className="grid grid-cols-2 gap-3">
                                {DIMENSIONS.map((dim) => (
                                    <button
                                        key={dim.id}
                                        onClick={() => handleDimensionSelect(dim)}
                                        className="flex flex-col items-start p-4 bg-card hover:bg-accent/50 border border-border hover:border-primary/50 rounded-xl transition-all text-left gap-2 group"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <dim.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <span className="font-medium text-foreground block">{dim.label}</span>
                                            <span className="text-xs text-muted-foreground">{dim.description}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // Detail View
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="h-40 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {groups.map((group, idx) => {
                                            const count = Number(group.count);
                                            const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;

                                            // Handle Status specifically if needed (mapping raw keys to display?)
                                            // Assuming group_key is correct.

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        onApplyFilter(activeDimension.id, group.group_key);
                                                        setIsOpen(false);
                                                    }}
                                                    className="relative overflow-hidden flex flex-col gap-2 p-3 bg-card hover:bg-accent/50 border border-border hover:border-primary/50 rounded-xl transition-all text-left group"
                                                >
                                                    <div className="flex justify-between items-start w-full relative z-10">
                                                        <span className="font-medium text-foreground truncate max-w-[85%]">
                                                            {group.group_key || "Unknown"}
                                                        </span>
                                                        <span className="text-sm font-bold text-primary tabular-nums">
                                                            {percentage}%
                                                        </span>
                                                    </div>

                                                    <div className="flex items-end justify-between mt-1 relative z-10">
                                                        <span className="text-xs text-muted-foreground">Count</span>
                                                        <span className="text-lg font-bold text-foreground">{count.toLocaleString()}</span>
                                                    </div>

                                                    {/* Background Progress Bar */}
                                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
                                                        <div
                                                            className="h-full bg-primary/50 transition-all duration-500"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </button>
                                            );
                                        })}

                                        {!loading && groups.length === 0 && (
                                            <div className="col-span-2 flex flex-col items-center justify-center h-40 text-muted-foreground p-4 border border-dashed border-border rounded-xl">
                                                <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                                                <p className="text-sm">No data found regarding this dimension.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
