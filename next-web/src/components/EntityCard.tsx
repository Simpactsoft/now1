"use client";

import { Building, User, Mail, Phone, MapPin, MoreHorizontal, Edit, Trash2, Copy } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '@/context/LanguageContext';

interface GenericEntity {
    id: string;
    displayName: string;
    type: string; // 'person' | 'organization'
    status?: string;
    email?: string;
    phone?: string;
    location?: string;
    industry?: string;
    website?: string;
}

interface EntityCardProps {
    entity: GenericEntity;
    tenantId: string;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export default function EntityCard({ entity, tenantId, onEdit, onDelete }: EntityCardProps) {
    const { language } = useLanguage();

    return (
        <div className="group bg-card hover:bg-muted/30 border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col h-full">
            {/* Top Gradient Accent (Optional) */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary/50 to-brand-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Header: Icon + Name + Menu */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${entity.type === 'organization' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                        {entity.type === 'organization' ? <Building size={20} /> : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground line-clamp-1 text-lg group-hover:text-primary transition-colors cursor-pointer" onClick={() => onEdit?.(entity.id)}>
                            {entity.displayName}
                        </h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            {entity.industry || entity.type}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {entity.status && (
                        <div className="scale-90 origin-right">
                            <StatusBadge status={entity.status} tenantId={tenantId} />
                        </div>
                    )}
                    <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-slate-100 transition-colors">
                        <MoreHorizontal size={18} />
                    </button>
                </div>
            </div>

            {/* Body: Details */}
            <div className="space-y-1.5 flex-grow">
                {entity.email && (
                    <div className="group/item flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors relative h-7 rounded px-1 -mx-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 truncate pr-6 min-w-0">
                            <Mail size={14} className="shrink-0" />
                            <span className="truncate">{entity.email}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entity.email!); }}
                            className="p-1 hover:bg-background rounded-md text-muted-foreground transition-opacity absolute right-1 shadow-sm border border-border/50"
                            title="Copy Email"
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                {entity.phone && (
                    <div className="group/item flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors relative h-7 rounded px-1 -mx-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 truncate pr-6 min-w-0">
                            <Phone size={14} className="shrink-0" />
                            <span className="ltr truncate">{entity.phone}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entity.phone!); }}
                            className="p-1 hover:bg-background rounded-md text-muted-foreground transition-opacity absolute right-1 shadow-sm border border-border/50"
                            title="Copy Phone"
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                {entity.website && (
                    <div className="group/item flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors relative h-7 rounded px-1 -mx-1 hover:bg-muted/50">
                        <div className="flex items-center gap-2 truncate pr-6 min-w-0">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="shrink-0"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                                <path d="M2 12h20" />
                            </svg>
                            <a
                                href={entity.website.startsWith('http') ? entity.website : `https://${entity.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {entity.website.replace(/^https?:\/\//, '')}
                            </a>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entity.website!); }}
                            className="p-1 hover:bg-background rounded-md text-muted-foreground transition-opacity absolute right-1 shadow-sm border border-border/50"
                            title="Copy Website"
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                )}
                {entity.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate h-7 px-1">
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate">{entity.location}</span>
                    </div>
                )}
                {!entity.email && !entity.phone && !entity.location && !entity.website && (
                    <div className="text-sm text-muted-foreground/50 italic py-2 px-1">
                        {language === 'he' ? 'אין פרטי התקשרות' : 'No contact details'}
                    </div>
                )}
            </div>

            {/* Footer: Quick Actions / Stats */}
            <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                <div className="flex gap-2">
                    {/* Placeholder for future stats */}
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Tasks</span>
                        <span className="text-sm font-semibold text-foreground">0</span>
                    </div>
                    <div className="w-px h-8 bg-border mx-1" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Docs</span>
                        <span className="text-sm font-semibold text-foreground">0</span>
                    </div>
                </div>

                {onEdit && (
                    <button
                        onClick={() => onEdit(entity.id)}
                        className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <Edit size={14} />
                        {language === 'he' ? 'ערוך' : 'Edit'}
                    </button>
                )}
            </div>
        </div>
    );
}
