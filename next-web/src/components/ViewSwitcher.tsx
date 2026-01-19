"use client";

import { LayoutGrid, GalleryHorizontalEnd, Tag } from "lucide-react";

interface ViewSwitcherProps {
    currentView: 'grid' | 'cards' | 'tags';
    onViewChange: (view: 'grid' | 'cards' | 'tags') => void;
}

export default function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
    return (
        <div className="flex items-center bg-secondary/50 p-1 rounded-lg border border-border gap-0.5">
            <button
                onClick={() => onViewChange('grid')}
                className={`p-1.5 rounded-md transition-all ${currentView === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                title="Grid View"
            >
                <LayoutGrid className="w-4 h-4" />
            </button>
            <button
                onClick={() => onViewChange('tags')}
                className={`p-1.5 rounded-md transition-all ${currentView === 'tags'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                title="Tags View"
            >
                <Tag className="w-4 h-4" />
            </button>
            <button
                onClick={() => onViewChange('cards')}
                className={`p-1.5 rounded-md transition-all ${currentView === 'cards'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                title="Card View"
            >
                <GalleryHorizontalEnd className="w-4 h-4" />
            </button>
        </div>
    );
}
