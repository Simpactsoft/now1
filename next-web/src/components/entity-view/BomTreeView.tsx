"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnDef } from "./types";

// ==================== Types ====================

interface BomTreeViewProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    getItemId: (item: T) => string;
    getLevel: (item: T) => number;
    getPath: (item: T) => string;
    onRowClick?: (item: T) => void;
    selectedIds?: string[];
    className?: string;
}

interface TreeNode<T> {
    item: T;
    id: string;
    level: number;
    path: string;
    children: TreeNode<T>[];
}

// ==================== Component ====================

function BomTreeViewInner<T = any>(props: BomTreeViewProps<T>) {
    const {
        data,
        columns,
        getItemId,
        getLevel,
        getPath,
        onRowClick,
        selectedIds = [],
        className = "",
    } = props;

    // Track expanded nodes
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Build tree structure from flat data
    const treeNodes = useMemo(() => {
        const nodeMap = new Map<string, TreeNode<T>>();
        const rootNodes: TreeNode<T>[] = [];

        // First pass: create all nodes
        data.forEach(item => {
            const id = getItemId(item);
            const level = getLevel(item);
            const path = getPath(item);

            nodeMap.set(id, {
                item,
                id,
                level,
                path,
                children: [],
            });
        });

        // Second pass: build parent-child relationships
        data.forEach(item => {
            const id = getItemId(item);
            const node = nodeMap.get(id)!;
            const pathParts = node.path.split(' > ');

            if (pathParts.length === 1) {
                // This is a root node
                rootNodes.push(node);
            } else {
                // Find parent by matching path
                const parentPath = pathParts.slice(0, -1).join(' > ');
                const parent = Array.from(nodeMap.values()).find(n => n.path === parentPath);

                if (parent) {
                    parent.children.push(node);
                } else {
                    // If no parent found, treat as root
                    rootNodes.push(node);
                }
            }
        });

        return rootNodes;
    }, [data, getItemId, getLevel, getPath]);

    // Flatten tree into visible rows based on expand state
    const visibleRows = useMemo(() => {
        const rows: Array<{ node: TreeNode<T>; depth: number }> = [];

        const traverse = (node: TreeNode<T>, depth: number) => {
            rows.push({ node, depth });

            if (expandedIds.has(node.id) && node.children.length > 0) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        };

        treeNodes.forEach(node => traverse(node, 0));
        return rows;
    }, [treeNodes, expandedIds]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleRowClick = (node: TreeNode<T>) => {
        if (onRowClick) {
            onRowClick(node.item);
        }
    };

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No data to display</p>
            </div>
        );
    }

    // Detect RTL from document direction
    const isRtl = typeof document !== 'undefined' && document.dir === 'rtl';

    return (
        <div className={cn("flex flex-col h-full overflow-auto", className)}>
            {/* Header */}
            <div className="flex items-center bg-muted/50 border-b border-border/50 sticky top-0 z-10">
                <div className="w-12 flex-shrink-0" /> {/* Spacer for expand button */}
                {columns.map((col, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "px-3 py-2 text-sm font-medium text-muted-foreground",
                            col.headerClass
                        )}
                        style={{
                            width: col.width,
                            minWidth: col.minWidth,
                            maxWidth: col.maxWidth,
                            flex: col.flex,
                        }}
                    >
                        {col.headerName}
                    </div>
                ))}
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-auto">
                {visibleRows.map(({ node, depth }) => {
                    const isExpanded = expandedIds.has(node.id);
                    const hasChildren = node.children.length > 0;
                    const isSelected = selectedIds.includes(node.id);

                    return (
                        <div
                            key={node.id}
                            className={cn(
                                "flex items-center border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors",
                                isSelected && "bg-accent"
                            )}
                            onClick={() => handleRowClick(node)}
                        >
                            {/* Expand/Collapse button */}
                            <div
                                className="w-12 flex-shrink-0 flex items-center justify-center"
                                style={{ paddingLeft: `${depth * 24}px` }}
                            >
                                {hasChildren ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpand(node.id);
                                        }}
                                        className="p-1 hover:bg-accent rounded transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : isRtl ? (
                                            <ChevronLeft className="w-4 h-4" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                    </button>
                                ) : null}
                            </div>

                            {/* Data columns */}
                            {columns.map((col, idx) => {
                                const value = col.valueGetter
                                    ? col.valueGetter(node.item)
                                    : (node.item as any)[col.field as string];

                                let content;
                                if (col.cellRenderer) {
                                    content = col.cellRenderer({ value, data: node.item });
                                } else if (col.valueFormatter) {
                                    content = col.valueFormatter(value);
                                } else {
                                    content = value != null ? String(value) : '';
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "px-3 py-2 text-sm truncate",
                                            col.cellClass
                                        )}
                                        style={{
                                            width: col.width,
                                            minWidth: col.minWidth,
                                            maxWidth: col.maxWidth,
                                            flex: col.flex,
                                        }}
                                        dangerouslySetInnerHTML={
                                            typeof content === 'string' ? { __html: content } : undefined
                                        }
                                    >
                                        {typeof content !== 'string' ? content : null}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ==================== Export ====================

export const BomTreeView = React.memo(BomTreeViewInner) as typeof BomTreeViewInner;
