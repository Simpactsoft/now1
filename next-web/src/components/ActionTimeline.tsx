import React from 'react';
import { Circle, FileText, CheckCircle, LogIn, AlertCircle } from 'lucide-react';

interface TimelineEvent {
    id: string;
    event_type: string;
    event_message: string;
    created_at: string;
}

interface ActionTimelineProps {
    events: TimelineEvent[];
}

export default function ActionTimeline({ events }: ActionTimelineProps) {
    if (!events || events.length === 0) {
        return (
            <div className="glass p-8 rounded-3xl border border-white/10 text-center">
                <p className="text-zinc-500">No recent activity recorded in the Action Stream.</p>
            </div>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'login': return <LogIn size={16} className="text-blue-400" />;
            case 'system_import': return <CheckCircle size={16} className="text-emerald-400" />;
            case 'alert': return <AlertCircle size={16} className="text-amber-400" />;
            default: return <FileText size={16} className="text-slate-400" />;
        }
    };

    return (

        <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
            <h3 className="text-xl font-bold text-foreground mb-3">Action Stream</h3>
            <div className="relative border-l border-border ml-3 space-y-8">
                {events.map((event) => (
                    <div key={event.id} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                                {getIcon(event.event_type)}
                                <span className="uppercase tracking-wider text-[10px] text-muted-foreground">{event.event_type}</span>
                            </div>
                            <p className="text-muted-foreground">{event.event_message}</p>
                            <span className="text-xs text-muted-foreground/70">
                                {new Date(event.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

}
