"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Phone, Mail, MoreHorizontal, UserCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

import { StatusBadge } from "./StatusBadge";
import { StatusCell } from "./StatusCell";
import { NameCell } from "./NameCell";
import { RoleCell } from "./RoleCell";

interface SimplePeopleTableProps {
    people: any[];
    loading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    onPersonClick: (id: string) => void;
    highlightId: string | null;
    tenantId: string;
    statusOptions: any[];
}

export default function SimplePeopleTable({
    people,
    loading,
    hasMore,
    loadMore,
    onPersonClick,
    highlightId,
    tenantId,
    statusOptions
}: SimplePeopleTableProps) {
    const { language } = useLanguage();
    const observerTarget = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadMore]);

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                    <tr>
                        <th className={`px-6 py-4 w-[350px] ${language === 'he' ? 'text-right' : 'text-left'}`}>
                            {language === 'he' ? 'איש קשר' : 'Person'}
                        </th>
                        <th className={`px-6 py-4 w-[150px] ${language === 'he' ? 'text-right' : 'text-left'}`}>
                            {language === 'he' ? 'סטטוס' : 'Status'}
                        </th>
                        <th className={`px-6 py-4 min-w-[200px] w-[250px] ${language === 'he' ? 'text-right' : 'text-left'}`}>
                            {language === 'he' ? 'תפקיד' : 'Role'}
                        </th>
                        <th className={`px-6 py-4 ${language === 'he' ? 'text-right' : 'text-left'}`}>
                            {language === 'he' ? 'תגיות' : 'Tags'}
                        </th>
                        <th className={`px-6 py-4 ${language === 'he' ? 'text-left' : 'text-right'}`}>
                            {language === 'he' ? 'אינטראקציה אחרונה' : 'Last Interaction'}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {people.map((person, index) => {
                        const id = person.ret_id || person.id;
                        const isHighlighted = highlightId === id;

                        return (
                            <tr
                                key={`${id}-${index}`}
                                onClick={() => onPersonClick(id)}
                                id={`person-${id}`}
                                className={`
                                    group transition-all duration-200 cursor-pointer hover:bg-muted/30
                                    ${isHighlighted ? 'bg-primary/5 hover:bg-primary/10' : ''}
                                `}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            {(person.ret_avatar_url || person.avatar_url) ? (
                                                <img
                                                    src={person.ret_avatar_url || person.avatar_url}
                                                    alt={person.ret_name || person.name}
                                                    className="w-10 h-10 rounded-full object-cover border border-border"
                                                />
                                            ) : (
                                                <UserCircle className="w-10 h-10 text-muted-foreground bg-secondary rounded-full p-2" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex flex-col min-w-0">
                                            <div onClick={(e) => e.stopPropagation()}>
                                                {tenantId ? (
                                                    <NameCell
                                                        firstName={(person.ret_name || person.name || 'Unknown').split(' ')[0]}
                                                        lastName={(person.ret_name || person.name || 'Unknown').split(' ').slice(1).join(' ') || '-'}
                                                        personId={id}
                                                        tenantId={tenantId}
                                                    />
                                                ) : (
                                                    <span className={`font-semibold truncate ${isHighlighted ? 'text-primary' : 'text-foreground'}`}>
                                                        {person.ret_name || person.name || person.full_name || 'Unknown'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                {/* Phone */}
                                                {(person.ret_phone || person.phone) && (
                                                    <div className="flex items-center gap-1" title={person.ret_phone || person.phone}>
                                                        <Phone className="w-3 h-3" />
                                                        <span className="truncate max-w-[100px]">{person.ret_phone || person.phone}</span>
                                                    </div>
                                                )}

                                                {/* Email */}
                                                {(person.ret_email || person.email) && (
                                                    <div className="flex items-center gap-1" title={person.ret_email || person.email}>
                                                        <Mail className="w-3 h-3" />
                                                        <span className="truncate max-w-[120px]">{person.ret_email || person.email}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                    {tenantId ? (
                                        <StatusCell
                                            status={person.ret_status}
                                            personId={id}
                                            tenantId={tenantId}
                                            statusOptions={statusOptions}
                                        />
                                    ) : (
                                        <StatusBadge status={person.ret_status || 'Lead'} tenantId={tenantId} />
                                    )}
                                </td>

                                <td className="px-6 py-4 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                    {tenantId ? (
                                        <RoleCell
                                            role={person.ret_role_name || person.role_name}
                                            personId={id}
                                            tenantId={tenantId}
                                        />
                                    ) : (
                                        person.ret_role_name || person.role_name || '-'
                                    )}
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {(person.ret_tags || []).slice(0, 3).map((tag: string, i: number) => (
                                            <span key={i} className="px-1.5 py-0.5 bg-secondary rounded text-[10px] text-muted-foreground border border-border/50">
                                                {tag}
                                            </span>
                                        ))}
                                        {(person.ret_tags || []).length > 3 && (
                                            <span className="text-[10px] text-muted-foreground px-1">+{person.ret_tags.length - 3}</span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">
                                    {person.ret_last_interaction
                                        ? new Date(person.ret_last_interaction).toLocaleDateString()
                                        : '-'
                                    }
                                </td>
                            </tr>
                        );
                    })}

                    {/* Infinite Scroll Trigger Row */}
                    {hasMore && (
                        <tr ref={observerTarget}>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                {loading ? 'Loading more...' : 'Scroll for more'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
