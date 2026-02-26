'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchImportHistory, ImportJob } from '@/app/actions/fetchImportHistory';
import { fetchImportedCards, ImportedCard } from '@/app/actions/fetchImportedCards';
import { rollbackImport } from '@/app/actions/rollbackImport';
import { downloadErrorReport } from '@/lib/importApi';
import { toast } from 'sonner';
import Link from 'next/link';
import {
    FileSpreadsheet,
    ChevronDown,
    ChevronUp,
    Undo2,
    Download,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RotateCcw,
    Plus,
    User,
    Building2,
    Loader2,
    ExternalLink,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    completed: { label: 'הושלם', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
    failed: { label: 'נכשל', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    rolled_back: { label: 'בוטל (Rollback)', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Undo2 },
    pending: { label: 'ממתין', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    processing: { label: 'מעבד...', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = statusConfig[status] || statusConfig.pending;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {cfg.label}
        </span>
    );
}

function JobRow({ job, onRollback }: { job: ImportJob; onRollback: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [cards, setCards] = useState<ImportedCard[]>([]);
    const [loadingCards, setLoadingCards] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);

    const loadCards = useCallback(async () => {
        if (cards.length > 0) return; // already loaded
        setLoadingCards(true);
        const res = await fetchImportedCards(job.id);
        if (res.success) {
            setCards(res.data);
        } else {
            toast.error(res.error || 'שגיאה בטעינת כרטיסים');
        }
        setLoadingCards(false);
    }, [job.id, cards.length]);

    const handleToggle = () => {
        const newExpanded = !expanded;
        setExpanded(newExpanded);
        if (newExpanded) loadCards();
    };

    const handleRollback = async () => {
        const confirmed = window.confirm(
            `האם אתה בטוח שברצונך לבטל את הייבוא הזה?\nפעולה זו תמחק ${job.created_count} כרטיסים שנוצרו.\nלא ניתן לבטל פעולה זו.`
        );
        if (!confirmed) return;
        setIsRollingBack(true);
        const res = await rollbackImport(job.id);
        if (res.success) {
            toast.success(`הייבוא בוטל — ${res.data.deleted} כרטיסים נמחקו`);
            onRollback(job.id);
        } else {
            toast.error(res.error || 'שגיאה בביטול הייבוא');
        }
        setIsRollingBack(false);
    };

    const createdAt = new Date(job.created_at);
    const canRollback = job.status === 'completed' && job.created_count > 0;

    return (
        <div className="border border-border rounded-xl bg-card overflow-hidden transition-shadow hover:shadow-sm">
            {/* Job Header */}
            <div
                onClick={handleToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggle(); }}
                className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-muted/30 transition-colors cursor-pointer"
            >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">
                            {job.file_name || 'ייבוא ללא שם'}
                        </span>
                        <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(createdAt, { addSuffix: true, locale: he })}</span>
                        <span>•</span>
                        <span>{job.total_rows} שורות</span>
                        {job.created_count > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-green-600">{job.created_count} נוצרו</span>
                            </>
                        )}
                        {job.error_count > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-red-600">{job.error_count} שגיאות</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions (stop propagation to prevent toggle on button click) */}
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {job.error_count > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => downloadErrorReport(job.id)}
                        >
                            <Download className="w-3.5 h-3.5 ml-1" />
                            דוח שגיאות
                        </Button>
                    )}
                    {canRollback && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={handleRollback}
                            disabled={isRollingBack}
                        >
                            {isRollingBack ? (
                                <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
                            ) : (
                                <Undo2 className="w-3.5 h-3.5 ml-1" />
                            )}
                            {isRollingBack ? 'מבטל...' : 'בטל ייבוא'}
                        </Button>
                    )}
                </div>

                {expanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
            </div>

            {/* Expanded Card List */}
            {expanded && (
                <div className="border-t border-border bg-muted/20">
                    {loadingCards ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">טוען כרטיסים...</span>
                        </div>
                    ) : cards.length === 0 ? (
                        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                            {job.status === 'rolled_back' ? 'הכרטיסים נמחקו (Rollback)' : 'לא נמצאו כרטיסים'}
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            <div className="px-5 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">
                                {cards.length} כרטיסים שיובאו
                            </div>
                            {cards.map(card => {
                                const href = card.type === 'organization'
                                    ? `/dashboard/organizations/${card.id}`
                                    : `/dashboard/people/${card.id}`;
                                const Icon = card.type === 'organization' ? Building2 : User;

                                return (
                                    <Link
                                        key={card.id}
                                        href={href}
                                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                                                {card.display_name}
                                            </span>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                {card.email && <span>{card.email}</span>}
                                                {card.email && card.phone && <span>•</span>}
                                                {card.phone && <span>{card.phone}</span>}
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ImportHistoryPage() {
    const [jobs, setJobs] = useState<ImportJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        setLoading(true);
        const res = await fetchImportHistory();
        if (res.success) {
            setJobs(res.data);
        } else {
            toast.error(res.error || 'שגיאה בטעינת היסטוריה');
        }
        setLoading(false);
    };

    const handleRollback = (jobId: string) => {
        setJobs(prev =>
            prev.map(j => j.id === jobId ? { ...j, status: 'rolled_back' } : j)
        );
    };

    const stats = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        totalImported: jobs.reduce((sum, j) => sum + (j.status !== 'rolled_back' ? j.created_count : 0), 0),
        rolledBack: jobs.filter(j => j.status === 'rolled_back').length,
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">היסטוריית ייבואים</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        מעקב אחר כל הייבואים, עם אפשרות לצפייה בכרטיסים וביטול.
                    </p>
                </div>
                <Link href="/dashboard/import">
                    <Button>
                        <Plus className="w-4 h-4 ml-1" />
                        ייבוא חדש
                    </Button>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-lg p-3 bg-card text-center">
                    <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">סה״כ ייבואים</div>
                </div>
                <div className="border rounded-lg p-3 bg-card text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    <div className="text-xs text-muted-foreground">הושלמו</div>
                </div>
                <div className="border rounded-lg p-3 bg-card text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalImported}</div>
                    <div className="text-xs text-muted-foreground">כרטיסים יובאו</div>
                </div>
                <div className="border rounded-lg p-3 bg-card text-center">
                    <div className="text-2xl font-bold text-gray-400">{stats.rolledBack}</div>
                    <div className="text-xs text-muted-foreground">בוטלו</div>
                </div>
            </div>

            {/* Jobs List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>טוען היסטוריה...</span>
                </div>
            ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                    <FileSpreadsheet className="w-12 h-12 opacity-30" />
                    <div className="text-center">
                        <p className="font-medium">אין ייבואים עדיין</p>
                        <p className="text-sm mt-1">התחל בייבוא הראשון שלך</p>
                    </div>
                    <Link href="/dashboard/import">
                        <Button variant="outline">
                            <Plus className="w-4 h-4 ml-1" />
                            ייבוא חדש
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {jobs.map(job => (
                        <JobRow key={job.id} job={job} onRollback={handleRollback} />
                    ))}
                </div>
            )}

            {/* Refresh */}
            {!loading && jobs.length > 0 && (
                <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={loadJobs} className="text-muted-foreground">
                        <RotateCcw className="w-3.5 h-3.5 ml-1" />
                        רענן
                    </Button>
                </div>
            )}
        </div>
    );
}
