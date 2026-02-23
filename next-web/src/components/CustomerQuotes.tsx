"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fetchQuotesByCustomer } from "@/app/actions/fetchQuotesByCustomer";
import { QuoteSummary } from "@/app/actions/fetchQuotes";
import { Loader2, FileText, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";

interface CustomerQuotesProps {
    tenantId: string;
    customerId: string;
}

export function CustomerQuotes({ tenantId, customerId }: CustomerQuotesProps) {
    const { language } = useLanguage();
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadQuotes = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const res = await fetchQuotesByCustomer(tenantId, customerId);
                if (isMounted) {
                    if (res.error) {
                        setError(res.error);
                    } else {
                        setQuotes(res.rowData || []);
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    setError("Failed to load quotes");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadQuotes();

        return () => {
            isMounted = false;
        };
    }, [tenantId, customerId]);

    const formatCurrency = (amount: number, currency = "ILS") => {
        return new Intl.NumberFormat(language === 'he' ? 'he-IL' : 'en-US', {
            style: "currency",
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="bg-card p-8 rounded-2xl border border-border flex justify-center items-center flex-col gap-4 !h-64 shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">{language === 'he' ? 'טוען הצעות מחיר...' : 'Loading quotes...'}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-destructive/10 p-6 rounded-2xl border border-destructive/20 text-center">
                <p className="text-destructive font-medium">{error}</p>
            </div>
        );
    }

    if (quotes.length === 0) {
        return (
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center text-center !h-64">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                    {language === 'he' ? 'אין הצעות מחיר' : 'No Quotes Yet'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    {language === 'he'
                        ? 'ללקוח זה עדיין אין הצעות מחיר מקושרות.'
                        : 'This customer doesn\'t have any quotes associated with them yet.'}
                </p>
                <Link href={`/dashboard/sales/quotes/new?customerId=${customerId}`}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        {language === 'he' ? 'הצעת מחיר חדשה' : 'Create Quote'}
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col gap-0">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {language === 'he' ? 'הצעות מחיר' : 'Quotes'}
                </h3>
                <Link href={`/dashboard/sales/quotes/new?customerId=${customerId}`}>
                    <Button variant="outline" size="sm" className="h-8">
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        {language === 'he' ? 'חדש' : 'New'}
                    </Button>
                </Link>
            </div>

            <div className="divide-y divide-border/50">
                {quotes.map((quote) => (
                    <div key={quote.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <Link
                                    href={`/dashboard/sales/quotes/${quote.id}/edit`}
                                    className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                >
                                    {quote.quote_number}
                                    <ExternalLink className="h-3 w-3 opacity-50" />
                                </Link>
                                <StatusBadge
                                    status={quote.status}
                                    tenantId={tenantId}
                                    code="QUOTE_STATUS"
                                />
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span>
                                    {format(new Date(quote.created_at), 'MMM d, yyyy')}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-border inline-block" />
                                    {quote.items_count} {language === 'he' ? 'פריטים' : 'items'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1">
                            <span className="font-bold text-lg text-foreground bg-secondary/50 px-3 py-1 rounded-lg border border-border/50">
                                {formatCurrency(quote.grand_total, quote.currency)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
