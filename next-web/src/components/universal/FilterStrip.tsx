"use client";

import { useViewConfig } from "./ViewConfigContext";
import SmartChip from "./SmartChip";
import AddFilterCommand from "./AddFilterCommand";
import { Filter as FilterIcon } from "lucide-react";

export default function FilterStrip() {
    const { filters, dispatch } = useViewConfig();

    return (
        <div className="flex items-center gap-2 w-full overflow-x-auto py-1 no-scrollbar bg-card/50 backdrop-blur-sm border-b border-border/50 px-2 min-h-[50px]">
            {/* Label / Icon */}
            <div className="flex items-center text-muted-foreground mr-2 opacity-50">
                <FilterIcon className="w-4 h-4" />
            </div>

            {/* Active Chips */}
            {filters.map((filter) => (
                <SmartChip
                    key={filter.id}
                    filter={filter}
                    onUpdate={(updates) => dispatch({ type: 'UPDATE_FILTER', payload: { id: filter.id, updates } })}
                    onRemove={() => dispatch({ type: 'REMOVE_FILTER', payload: filter.id })}
                />
            ))}

            {/* Add Button */}
            <AddFilterCommand
                onSelectField={(field) => dispatch({
                    type: 'ADD_FILTER',
                    payload: {
                        id: `new_${field}_${Date.now()}`,
                        field,
                        operator: 'equals',
                        value: '',
                        isEnabled: true,
                        defaultOpen: true
                    }
                })}
            />

            {/* Clear All */}
            {filters.length > 0 && (
                <button
                    onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-destructive uppercase tracking-wider px-2"
                >
                    Clear All
                </button>
            )}
        </div>
    );
}
