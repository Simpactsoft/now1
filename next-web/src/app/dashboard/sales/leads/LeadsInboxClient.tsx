"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { updateLeadStatus } from "@/app/actions/lead-actions";
import { Mail, Phone, Calendar, User, Building, ExternalLink, Activity, Trophy, ThumbsDown, Trash2 } from "lucide-react";

export function LeadsInboxClient({ tenantId, initialLeads }: { tenantId: string, initialLeads: any[] }) {
    const [leads, setLeads] = useState(initialLeads);
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        setIsLoading(leadId);
        const res = await updateLeadStatus(tenantId, leadId, newStatus);

        if (res.success) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            toast.success(`Lead marked as ${newStatus}`);
        } else {
            toast.error("Failed to update lead status");
        }
        setIsLoading(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'contacted': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'working': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'qualified': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'converted': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'unqualified':
            case 'junk': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <div className="flex-1 overflow-auto custom-scrollbar pr-2 pb-4">
            {leads.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                        <Mail className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-medium">Inbox Zero</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm">
                        You have no new leads in your inbox. Check back later or import new leads to get started.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.map((lead) => (
                        <div key={lead.id} className="bg-card border border-border/50 rounded-xl p-5 flex flex-col hover:border-border/80 transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        {lead.raw_name || 'Anonymous Lead'}
                                    </h3>
                                    {lead.raw_company && (
                                        <div className="flex items-center text-sm text-muted-foreground mt-1 gap-1.5">
                                            <Building className="w-3.5 h-3.5" />
                                            <span>{lead.raw_company}</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize flex-shrink-0 ${getStatusColor(lead.status)}`}>
                                    {lead.status}
                                </span>
                            </div>

                            <div className="space-y-2 mt-2 mb-6 flex-1">
                                {lead.raw_email && (
                                    <div className="flex items-center text-sm gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <a href={`mailto:${lead.raw_email}`} className="hover:underline">{lead.raw_email}</a>
                                    </div>
                                )}
                                {lead.raw_phone && (
                                    <div className="flex items-center text-sm gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <a href={`tel:${lead.raw_phone}`} className="hover:underline">{lead.raw_phone}</a>
                                    </div>
                                )}
                                <div className="flex items-center text-xs text-muted-foreground gap-2 pt-2">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Received {format(new Date(lead.created_at), 'MMM d, yyyy h:mm a')}</span>
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground gap-2">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span className="capitalize">Source: {lead.source || 'Unknown'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                                {lead.status === 'new' && (
                                    <button
                                        onClick={() => handleStatusChange(lead.id, 'contacted')}
                                        disabled={isLoading === lead.id}
                                        className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-md hover:opacity-90 transition-opacity"
                                    >
                                        Mark Contacted
                                    </button>
                                )}

                                {(lead.status === 'contacted' || lead.status === 'working') && (
                                    <button
                                        onClick={() => handleStatusChange(lead.id, 'qualified')}
                                        disabled={isLoading === lead.id}
                                        className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 text-sm font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Trophy className="w-3.5 h-3.5" />
                                        Qualify
                                    </button>
                                )}

                                {lead.status !== 'unqualified' && lead.status !== 'junk' && lead.status !== 'converted' && (
                                    <button
                                        onClick={() => handleStatusChange(lead.id, 'unqualified')}
                                        disabled={isLoading === lead.id}
                                        className="px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                        title="Mark Unqualified"
                                    >
                                        <ThumbsDown className="w-4 h-4" />
                                    </button>
                                )}

                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
