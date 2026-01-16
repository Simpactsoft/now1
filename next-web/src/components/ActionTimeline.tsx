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
        <div className="glass p-8 rounded-3xl border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6">Action Stream</h3>
            <div className="relative border-l border-white/10 ml-3 space-y-8">
                {events.map((event) => (
                    <div key={event.id} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
                                {getIcon(event.event_type)}
                                <span className="uppercase tracking-wider text-[10px] text-slate-500">{event.event_type}</span>
                            </div>
                            <p className="text-slate-300">{event.event_message}</p>
                            <span className="text-xs text-slate-600">
                                {new Date(event.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
