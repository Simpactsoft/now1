"use client";

import { useState } from "react";
import { Command } from "cmdk";
import {
    Plus,
    Search,
    User,
    Activity,
    Briefcase,
    Building2,
    Factory,
    Calendar,
    Tags,
    ChevronRight
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useLanguage } from "@/context/LanguageContext";


interface AddFilterCommandProps {
    onSelectField: (field: string) => void;
    minimal?: boolean;
    fields?: { id: string; label: string; icon: any }[];
}

// Moved inside component to access language
const getAvailableFields = (lang: string) => [
    { id: 'search', label: lang === 'he' ? 'חיפוש גלובלי' : 'Global Search', icon: Search },
    { id: 'name', label: lang === 'he' ? 'שם' : 'Name', icon: User },
    { id: 'status', label: lang === 'he' ? 'סטטוס' : 'Status', icon: Activity },
    { id: 'role_name', label: lang === 'he' ? 'תפקיד' : 'Role', icon: Briefcase },
    { id: 'industry', label: lang === 'he' ? 'תעשייה' : 'Industry', icon: Factory },
    { id: 'joined_year', label: lang === 'he' ? 'שנת הצטרפות' : 'Joined Year', icon: Calendar },
    { id: 'tags', label: lang === 'he' ? 'תגיות' : 'Tags', icon: Tags },
];

export default function AddFilterCommand({ onSelectField, minimal = false, fields }: AddFilterCommandProps) {
    const [open, setOpen] = useState(false);
    const { language } = useLanguage();

    const AVAILABLE_FIELDS = fields || getAvailableFields(language);

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                {minimal ? (
                    <button
                        className={`
                            w-[26px] h-[26px] flex items-center justify-center p-0 rounded-full bg-transparent border border-border text-primary hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm
                            ${open ? 'ring-2 ring-offset-1 ring-primary/30' : ''}
                        `}
                        title="Add Filter"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                ) : (
                    <button className={`
                        group flex items-center gap-2 px-4 py-2 
                        bg-primary text-primary-foreground 
                        text-sm font-medium rounded-full 
                        hover:opacity-90 active:scale-95 transition-all 
                        shadow-md hover:shadow-lg
                        ${open ? 'ring-2 ring-offset-2 ring-primary/30' : ''}
                    `}>
                        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                        <span>Add Filter</span>
                    </button>
                )}
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="w-[260px] p-1 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 shadow-2xl rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl"
                    align="start"
                    sideOffset={8}
                >
                    <Command className="w-full bg-transparent overflow-hidden">
                        <div className="flex items-center px-3 py-2 border-b border-border/40 pb-2 mb-1">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                            <Command.Input
                                placeholder={language === 'he' ? 'חפש שדות...' : 'Search fields...'}
                                className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                                autoFocus
                            />
                        </div>
                        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-1 px-1">
                            <Command.Empty className="py-4 text-center text-xs text-muted-foreground">
                                {language === 'he' ? 'לא נמצאו שדות' : 'No matching fields via search.'}
                            </Command.Empty>
                            <Command.Group heading={language === 'he' ? 'מסננים זמינים' : 'Available Filters'} className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1 select-none">
                                {AVAILABLE_FIELDS.map((f) => {
                                    const Icon = f.icon;
                                    return (
                                        <Command.Item
                                            key={f.id}
                                            onSelect={() => {
                                                onSelectField(f.id);
                                                setOpen(false);
                                            }}
                                            className="
                                                relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 
                                                text-sm outline-none transition-colors 
                                                data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground
                                                group
                                            "
                                        >
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/50 mr-3 group-data-[selected=true]:bg-background/80 shadow-sm border border-border/20">
                                                <Icon className="w-4 h-4 text-muted-foreground group-data-[selected=true]:text-primary" />
                                            </div>
                                            <span className="flex-1 font-medium">{f.label}</span>
                                            <ChevronRight className="w-3 h-3 opacity-0 group-data-[selected=true]:opacity-50 transition-opacity" />
                                        </Command.Item>
                                    );
                                })}
                            </Command.Group>
                        </Command.List>
                    </Command >
                </Popover.Content >
            </Popover.Portal >
        </Popover.Root >
    );
}
