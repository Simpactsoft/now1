"use client";

import { Sliders, Clock, Package } from "lucide-react";

interface CPQTemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    tenantId: string;
    createdAt: string;
    updatedAt: string;
}

interface CPQTemplateTagsProps {
    templates: CPQTemplate[];
    loading?: boolean;
    onTemplateClick: (template: CPQTemplate) => void;
    highlightId?: string | null;
}

export default function CPQTemplateTags({
    templates,
    loading,
    onTemplateClick,
    highlightId
}: CPQTemplateTagsProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!templates || templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Templates Found</h3>
                <p className="text-sm text-muted-foreground">
                    Create your first CPQ template to get started
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 pb-24">
            <div className="flex flex-wrap gap-3">
                {templates.map((template) => {
                    const isHighlighted = highlightId === template.id;
                    const formattedDate = template.updatedAt
                        ? new Date(template.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })
                        : null;

                    return (
                        <button
                            key={template.id}
                            onClick={() => onTemplateClick(template)}
                            className={`
                                group relative
                                inline-flex flex-col items-start
                                px-4 py-3
                                rounded-lg
                                border-2
                                transition-all duration-200
                                hover:shadow-md hover:scale-105
                                ${isHighlighted
                                    ? 'border-primary bg-primary/5 shadow-lg scale-105'
                                    : 'border-border bg-card hover:border-primary/50'
                                }
                            `}
                        >
                            {/* Top Row: Icon + Name */}
                            <div className="flex items-center gap-2 mb-1">
                                <Sliders className={`w-4 h-4 ${isHighlighted ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                                <span className="font-medium text-sm">
                                    {template.name}
                                </span>
                            </div>

                            {/* Description (if exists) */}
                            {template.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-1 max-w-xs">
                                    {template.description}
                                </p>
                            )}

                            {/* Bottom Row: Category + Date */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {template.category && (
                                    <span className="px-2 py-0.5 bg-secondary rounded-full">
                                        {template.category}
                                    </span>
                                )}
                                {formattedDate && (
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{formattedDate}</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
