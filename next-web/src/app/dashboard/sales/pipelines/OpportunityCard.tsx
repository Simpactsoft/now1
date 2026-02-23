import { useDraggable } from "@dnd-kit/core";
import { Copy, Plus, Menu } from "lucide-react";
import { format } from "date-fns";

interface OpportunityCardProps {
    opportunity: any;
    isDragging?: boolean;
}

export function OpportunityCard({ opportunity, isDragging }: OpportunityCardProps) {
    const { attributes, listeners, setNodeRef, isDragging: isDraggingInternal } = useDraggable({
        id: opportunity.id,
    });

    const dragging = isDragging || isDraggingInternal;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`
                bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all
                ${dragging ? 'opacity-50 border-primary ring-2 ring-primary/20 scale-[1.02]' : 'border-border'}
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-sm text-foreground line-clamp-1 leading-tight">
                    {opportunity.name}
                </span>
                <button
                    className="text-muted-foreground hover:bg-muted p-1 rounded-sm"
                    onClick={(e) => {
                        e.stopPropagation(); // prevent drag
                        // TODO: Open edit modal
                    }}
                >
                    <Menu className="w-4 h-4" />
                </button>
            </div>

            <div className="text-sm font-semibold text-primary mb-2">
                ${(opportunity.amount || 0).toLocaleString()}
                {opportunity.currency && opportunity.currency !== 'USD' && ` ${opportunity.currency}`}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                <div className="truncate flex-1 max-w-[120px]" title={opportunity.card?.company_name || opportunity.card?.display_name}>
                    {opportunity.card?.company_name || opportunity.card?.display_name || 'No contact'}
                </div>
                {opportunity.expected_close && (
                    <div className="text-right">
                        {format(new Date(opportunity.expected_close), "MMM d")}
                    </div>
                )}
            </div>
        </div>
    );
}
