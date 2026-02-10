// EntityCards.tsx — Generic reusable card grid view with Tailwind CSS
// Replaces inline card rendering with a standardized component.

"use client";

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CardsRenderProps } from './types';
import { Loader2, Check } from 'lucide-react';

// ==================== Props ====================

interface EntityCardsProps<T> extends CardsRenderProps<T> {
    columns?: number;
    gap?: number;
    minCardWidth?: number;
    maxCardWidth?: number;
    className?: string;
}

// ==================== Component ====================

function EntityCardsInner<T = any>(props: EntityCardsProps<T>) {
    const {
        data,
        loading,
        selectedIds,
        onCardClick,
        onSelectionChange,
        renderCard,
        columns = 3,
        gap = 16,
        minCardWidth = 280,
        maxCardWidth = 400,
        className,
    } = props;

    const getItemId = useCallback((item: any): string => {
        return item.id || item.ret_id || item._id;
    }, []);

    const handleCardClick = useCallback((item: T) => {
        if (onCardClick) {
            onCardClick(item);
        }
    }, [onCardClick]);

    const handleToggleSelection = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    }, [selectedIds, onSelectionChange]);

    // ---- Loading State ----
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                <p className="text-sm">טוען נתונים...</p>
            </div>
        );
    }

    // ---- Empty State ----
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                אין נתונים להצגה
            </div>
        );
    }

    // ---- Grid of Cards ----
    return (
        <div
            className={cn("w-full p-4", className)}
            style={{
                display: 'grid',
                gap: `${gap}px`,
                gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
            }}
        >
            {data.map((item: any) => {
                const id = getItemId(item);
                const isSelected = selectedIds.includes(id);

                return (
                    <div
                        key={id}
                        className={cn(
                            "relative cursor-pointer transition-all duration-200 group",
                            isSelected && "ring-2 ring-primary scale-[0.98]"
                        )}
                        onClick={() => handleCardClick(item)}
                    >
                        {renderCard(item, isSelected)}

                        {/* Selection Indicator */}
                        {isSelected && (
                            <div
                                className="absolute top-2 left-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md z-10"
                                onClick={(e) => handleToggleSelection(e, id)}
                            >
                                <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ==================== Default Card Renderer Factory ====================

export function createDefaultCardRenderer<T>(config: {
    title: (item: T) => string;
    subtitle?: (item: T) => string;
    description?: (item: T) => string;
    image?: (item: T) => string | undefined;
    badges?: (item: T) => Array<{ label: string; color: string }>;
    actions?: (item: T) => React.ReactNode;
}) {
    return (item: T, isSelected: boolean) => (
        <div className={cn(
            "bg-card rounded-lg border border-border shadow-sm overflow-hidden h-full flex flex-col",
            "transition-all duration-200 hover:shadow-md hover:border-primary/30",
            isSelected && "border-primary"
        )}>
            {/* Image */}
            {config.image && config.image(item) && (
                <div className="w-full h-48 overflow-hidden bg-muted">
                    <img
                        src={config.image(item)!}
                        alt={config.title(item)}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col gap-1.5">
                <h3 className="text-base font-semibold text-foreground truncate">
                    {config.title(item)}
                </h3>

                {config.subtitle && (
                    <p className="text-sm text-muted-foreground truncate">
                        {config.subtitle(item)}
                    </p>
                )}

                {config.description && (
                    <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed">
                        {config.description(item)}
                    </p>
                )}

                {/* Badges */}
                {config.badges && config.badges(item).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {config.badges(item).map((badge, index) => (
                            <span
                                key={index}
                                className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: badge.color }}
                            >
                                {badge.label}
                            </span>
                        ))}
                    </div>
                )}

                {/* Actions */}
                {config.actions && (
                    <div className="mt-auto pt-3 border-t border-border flex gap-2 justify-end">
                        {config.actions(item)}
                    </div>
                )}
            </div>
        </div>
    );
}

// ==================== Export with React.memo ====================

export const EntityCards = React.memo(EntityCardsInner) as typeof EntityCardsInner;
