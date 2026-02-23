import { useDroppable } from "@dnd-kit/core";
import { OpportunityCard } from "./OpportunityCard";

interface PipelineColumnProps {
    stage: any;
    opportunities: any[];
}

export function PipelineColumn({ stage, opportunities }: PipelineColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
    });

    const totalValue = opportunities.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);

    return (
        <div
            ref={setNodeRef}
            className={`w-80 flex flex-col flex-shrink-0 bg-secondary/30 border border-border rounded-xl h-full transition-colors ${isOver ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : ''}`}
        >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/40 rounded-t-xl">
                <div>
                    <h3 className="font-semibold text-foreground flex items-center space-x-2">
                        {stage.stage_color && (
                            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: stage.stage_color }} />
                        )}
                        <span>{stage.name}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {opportunities.length} {" "}{opportunities.length === 1 ? 'deal' : 'deals'} • ${totalValue.toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px]">
                {opportunities.map(opp => (
                    <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
            </div>
        </div>
    );
}
