'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    FileText,
    Loader2,
    RefreshCw,
    ChevronRight,
    Search,
    AlertCircle,
    ExternalLink
} from 'lucide-react';
import { fetchQuotes, type QuoteSummary } from '@/app/actions/fetchQuotes';

// Status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', label: 'Draft' },
    sent: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', label: 'Sent' },
    confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Confirmed' },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', label: 'Cancelled' },
    shipped: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', label: 'Shipped' },
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_COLORS[status] || { bg: 'bg-secondary', text: 'text-muted-foreground', label: status };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
}

function formatCurrency(amount: number, currency: string = 'ILS') {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(dateStr: string) {
    return new Intl.DateTimeFormat('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateStr));
}

export function QuotesListClient({ tenantId }: { tenantId?: string }) {
    const router = useRouter();
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const loadQuotes = async () => {
        if (!tenantId) {
            setError('No tenant selected');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const result = await fetchQuotes(tenantId);
            if (result.error) {
                setError(result.error);
            }
            setQuotes(result.rowData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQuotes();
    }, [tenantId]);

    const filteredQuotes = quotes.filter(q => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            q.customer_name?.toLowerCase().includes(s) ||
            q.quote_number?.toLowerCase().includes(s) ||
            q.status.toLowerCase().includes(s)
        );
    });

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-border bg-card/50 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <FileText className="text-brand-primary" size={24} />
                            הצעות מחיר
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {loading ? '...' : `${filteredQuotes.length} הצעות מחיר`}
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/sales/quotes/new')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        הצעה חדשה
                    </button>
                </div>

                {/* Search + Refresh */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="חיפוש לפי לקוח, מספר, סטטוס..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full ps-9 pe-3 py-2 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                        />
                    </div>
                    <button
                        onClick={loadQuotes}
                        disabled={loading}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-brand-primary" size={32} />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-destructive">
                        <AlertCircle size={40} className="mb-3 opacity-60" />
                        <p className="font-medium">שגיאה בטעינת הצעות מחיר</p>
                        <p className="text-sm mt-1 opacity-70">{error}</p>
                        <button
                            onClick={loadQuotes}
                            className="mt-4 px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80"
                        >
                            נסה שוב
                        </button>
                    </div>
                ) : filteredQuotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <FileText size={48} className="mb-4 opacity-30" />
                        {quotes.length === 0 ? (
                            <>
                                <p className="text-lg font-medium">אין הצעות מחיר עדיין</p>
                                <p className="text-sm mt-1">לחץ על &quot;הצעה חדשה&quot; ליצירת הצעת מחיר ראשונה</p>
                                <button
                                    onClick={() => router.push('/dashboard/sales/quotes/new')}
                                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-medium text-sm transition-colors"
                                >
                                    <Plus size={18} />
                                    הצעה חדשה
                                </button>
                            </>
                        ) : (
                            <p className="text-lg font-medium">לא נמצאו תוצאות עבור &quot;{search}&quot;</p>
                        )}
                    </div>
                ) : (
                    /* Quotes Table */
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-secondary/30">
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">#</th>
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">לקוח</th>
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">סטטוס</th>
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">פריטים</th>
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">סכום</th>
                                    <th className="text-start px-4 py-3 font-semibold text-muted-foreground">תאריך</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuotes.map((quote, idx) => (
                                    <tr
                                        key={quote.id}
                                        className="border-b border-border last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors group"
                                        onClick={() => {
                                            router.push(`/dashboard/sales/quotes/new?quoteId=${quote.id}`);
                                        }}
                                    >
                                        <td className="px-4 py-3 font-mono text-muted-foreground">
                                            {quote.quote_number}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {quote.customer_id ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/people/${quote.customer_id}`);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-brand-primary hover:underline hover:text-brand-primary/80 transition-colors"
                                                >
                                                    {quote.customer_name || 'Unknown'}
                                                    <ExternalLink size={12} className="opacity-50" />
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground italic">ללא לקוח</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={quote.status} />
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                                            {quote.items_count} פריטים
                                        </td>
                                        <td className="px-4 py-3 font-semibold tabular-nums">
                                            {formatCurrency(quote.grand_total, quote.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {formatDate(quote.created_at)}
                                        </td>
                                        <td className="px-2 py-3">
                                            <ChevronRight
                                                size={16}
                                                className="text-muted-foreground opacity-0 group-hover:opacity-100 rtl:rotate-180 transition-opacity"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
