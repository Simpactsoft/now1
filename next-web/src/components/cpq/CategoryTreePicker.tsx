"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Category {
    id: string;
    name: string;
    path: string;
    children?: Category[];
}

interface CategoryTreePickerProps {
    value?: string;
    onChange: (categoryId: string, categoryPath: string) => void;
    placeholder?: string;
}

export function CategoryTreePicker({
    value,
    onChange,
    placeholder = "Select a category...",
}: CategoryTreePickerProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPath, setSelectedPath] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Fetch categories on mount
    useEffect(() => {
        async function fetchCategories() {
            try {
                // TODO: Replace with actual API call
                // For now, return mock data
                const mockCategories: Category[] = [
                    {
                        id: "1",
                        name: "Electronics",
                        path: "Electronics",
                        children: [
                            {
                                id: "2",
                                name: "Computers",
                                path: "Electronics.Computers",
                                children: [
                                    {
                                        id: "3",
                                        name: "Laptops",
                                        path: "Electronics.Computers.Laptops",
                                    },
                                    {
                                        id: "4",
                                        name: "Desktops",
                                        path: "Electronics.Computers.Desktops",
                                    },
                                ],
                            },
                            {
                                id: "5",
                                name: "Phones",
                                path: "Electronics.Phones",
                            },
                        ],
                    },
                    {
                        id: "6",
                        name: "Accessories",
                        path: "Accessories",
                        children: [
                            {
                                id: "7",
                                name: "Wheels",
                                path: "Accessories.Wheels",
                            },
                        ],
                    },
                ];
                setCategories(mockCategories);
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchCategories();
    }, []);

    const toggleNode = (categoryId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedNodes(newExpanded);
    };

    const handleSelect = (category: Category) => {
        setSelectedPath(category.path);
        onChange(category.id, category.path);
    };

    const renderCategory = (category: Category, level = 0) => {
        const isExpanded = expandedNodes.has(category.id);
        const isSelected = value === category.id;
        const hasChildren = category.children && category.children.length > 0;

        // Filter based on search
        if (searchTerm) {
            const matches = category.name
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
            if (!matches) return null;
        }

        return (
            <div key={category.id}>
                <div
                    className={cn(
                        "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50",
                        isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                >
                    {hasChildren && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(category.id);
                            }}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                        </Button>
                    )}
                    {!hasChildren && <div className="w-4" />}
                    <div
                        className="flex items-center gap-2 flex-1"
                        onClick={() => handleSelect(category)}
                    >
                        {isExpanded ? (
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Folder className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">{category.name}</span>
                    </div>
                </div>
                {isExpanded &&
                    hasChildren &&
                    category.children?.map((child) =>
                        renderCategory(child, level + 1)
                    )}
            </div>
        );
    };

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading categories...</div>;
    }

    return (
        <div className="space-y-2">
            <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
            />
            {selectedPath && (
                <div className="text-xs text-muted-foreground">
                    Selected: <span className="font-medium">{selectedPath}</span>
                </div>
            )}
            <ScrollArea className="h-[300px] border rounded-md p-2">
                {categories.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No categories found
                    </div>
                ) : (
                    categories.map((category) => renderCategory(category))
                )}
            </ScrollArea>
        </div>
    );
}
