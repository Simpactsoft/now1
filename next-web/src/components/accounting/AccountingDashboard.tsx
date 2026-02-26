"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useCallback } from "react";
import {
    BookOpen,
    Plus,
    FileText,
    TrendingUp,
    Loader2,
    ChevronRight,
    BarChart3,
    Scale,
} from "lucide-react";
import {
    getChartOfAccounts,
    getJournalEntries,
    getTrialBalance,
    createAccount,
    createJournalEntry,
    postJournalEntry,
    voidJournalEntry,
    getProfitAndLoss,
    getBalanceSheet,
} from "@/app/actions/accounting-actions";

// ============================================================================
// TYPES
// ============================================================================

interface Account {
    id: string;
    accountNumber: string;
    name: string;
    accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
    description: string | null;
    isActive: boolean;
    currency: string;
    normalBalance: "debit" | "credit";
}

interface JournalEntryView {
    id: string;
    entryNumber: number;
    entryDate: string;
    memo: string | null;
    status: string;
}

interface TrialBalanceRow {
    accountId: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AccountingDashboard({ tenantId }: { tenantId: string }) {
    const [activeTab, setActiveTab] = useState<"accounts" | "journal" | "trial" | "pnl" | "balance">("accounts");

    const tabs = [
        { id: "accounts" as const, label: "Chart of Accounts", icon: BookOpen },
        { id: "journal" as const, label: "Journal Entries", icon: FileText },
        { id: "trial" as const, label: "Trial Balance", icon: TrendingUp },
        { id: "pnl" as const, label: "Profit & Loss", icon: BarChart3 },
        { id: "balance" as const, label: "Balance Sheet", icon: Scale },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Accounting</h1>
                <p className="text-sm text-muted-foreground">Chart of accounts, journal entries, and trial balance</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === "accounts" && <AccountsTab tenantId={tenantId} />}
                {activeTab === "journal" && <JournalTab tenantId={tenantId} />}
                {activeTab === "trial" && <TrialBalanceTab tenantId={tenantId} />}
                {activeTab === "pnl" && <ProfitLossTab tenantId={tenantId} />}
                {activeTab === "balance" && <BalanceSheetTab tenantId={tenantId} />}
            </div>
        </div>
    );
}

// ============================================================================
// CHART OF ACCOUNTS TAB
// ============================================================================

function AccountsTab({ tenantId }: { tenantId: string }) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        const result = await getChartOfAccounts(tenantId);
        if (result.success && result.data) setAccounts(result.data);
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const typeColors: Record<string, string> = {
        asset: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        liability: "bg-red-500/10 text-red-600 dark:text-red-400",
        equity: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        revenue: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        expense: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" /> New Account
                </button>
            </div>

            {accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No accounts yet</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account #</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Normal Balance</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Currency</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {accounts.map((acct) => (
                                <tr key={acct.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-mono text-xs font-medium">{acct.accountNumber}</td>
                                    <td className="px-4 py-3 font-medium">{acct.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeColors[acct.accountType] || ''}`}>
                                            {acct.accountType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 capitalize text-muted-foreground">{acct.normalBalance}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{acct.currency}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showForm && (
                <AccountFormModal
                    tenantId={tenantId}
                    onClose={() => setShowForm(false)}
                    onSuccess={fetchAccounts}
                />
            )}
        </div>
    );
}

// ============================================================================
// JOURNAL ENTRIES TAB
// ============================================================================

function JournalTab({ tenantId }: { tenantId: string }) {
    const [entries, setEntries] = useState<JournalEntryView[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        const result = await getJournalEntries(tenantId);
        if (result.success && result.data) {
            setEntries(result.data.map(e => ({
                id: e.id,
                entryNumber: e.entryNumber,
                entryDate: e.entryDate,
                memo: e.memo,
                status: e.status,
            })));
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const handlePost = async (entryId: string) => {
        setProcessingId(entryId);
        const result = await postJournalEntry(entryId);
        if (result.success) {
            fetchEntries();
        } else {
            toast.error(`Failed to post: ${result.error}`);
        }
        setProcessingId(null);
    };

    const handleVoid = async (entryId: string) => {
        if (!confirm('Void this journal entry? This cannot be undone.')) return;
        setProcessingId(entryId);
        const result = await voidJournalEntry(entryId, 'Voided via Accounting Dashboard');
        if (result.success) {
            fetchEntries();
        } else {
            toast.error(`Failed to void: ${result.error}`);
        }
        setProcessingId(null);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6">
            {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No journal entries yet</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">#</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Memo</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-mono text-xs">{entry.entryNumber}</td>
                                    <td className="px-4 py-3 text-xs">{entry.entryDate}</td>
                                    <td className="px-4 py-3">{entry.memo || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${entry.status === 'posted' ? 'bg-emerald-500/10 text-emerald-600'
                                            : entry.status === 'voided' ? 'bg-red-500/10 text-red-600'
                                                : 'bg-amber-500/10 text-amber-600'
                                            }`}>
                                            {entry.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {entry.status === 'draft' && (
                                            <button
                                                onClick={() => handlePost(entry.id)}
                                                disabled={processingId === entry.id}
                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                            >
                                                {processingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                Post
                                            </button>
                                        )}
                                        {entry.status === 'posted' && (
                                            <button
                                                onClick={() => handleVoid(entry.id)}
                                                disabled={processingId === entry.id}
                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                            >
                                                {processingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                Void
                                            </button>
                                        )}
                                        {entry.status === 'voided' && (
                                            <span className="text-xs text-muted-foreground">Voided</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// TRIAL BALANCE TAB
// ============================================================================

function TrialBalanceTab({ tenantId }: { tenantId: string }) {
    const [rows, setRows] = useState<TrialBalanceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const fetchBalance = useCallback(async () => {
        setLoading(true);
        const result = await getTrialBalance(tenantId, asOfDate);
        if (result.success && result.data) setRows(result.data);
        setLoading(false);
    }, [tenantId, asOfDate]);

    useEffect(() => { fetchBalance(); }, [fetchBalance]);

    const totalDebits = rows.reduce((sum, r) => sum + r.debitBalance, 0);
    const totalCredits = rows.reduce((sum, r) => sum + r.creditBalance, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6 space-y-4">
            {/* Date Picker */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground">As of Date</label>
                <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No data for trial balance</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account #</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account Name</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Debit</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row) => (
                                <tr key={row.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-mono text-xs">{row.accountNumber}</td>
                                    <td className="px-4 py-3 font-medium">{row.accountName}</td>
                                    <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{row.accountType}</td>
                                    <td className="px-4 py-3 text-end font-mono">{row.debitBalance > 0 ? row.debitBalance.toFixed(2) : "\u2014"}</td>
                                    <td className="px-4 py-3 text-end font-mono">{row.creditBalance > 0 ? row.creditBalance.toFixed(2) : "\u2014"}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-muted/30 font-semibold">
                            <tr>
                                <td colSpan={3} className="px-4 py-3 text-end">Trial Balance as of {asOfDate}</td>
                                <td className="px-4 py-3 text-end font-mono">{totalDebits.toFixed(2)}</td>
                                <td className="px-4 py-3 text-end font-mono">{totalCredits.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td colSpan={5} className={`px-4 py-2 text-center text-xs font-medium ${isBalanced ? 'text-emerald-600 bg-emerald-500/5' : 'text-red-600 bg-red-500/5'}`}>
                                    {isBalanced ? "\u2713 Trial Balance is balanced" : `\u26a0 Out of balance by ${Math.abs(totalDebits - totalCredits).toFixed(2)}`}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// ACCOUNT FORM MODAL
// ============================================================================

function AccountFormModal({
    tenantId,
    onClose,
    onSuccess,
}: {
    tenantId: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [accountNumber, setAccountNumber] = useState("");
    const [name, setName] = useState("");
    const [accountType, setAccountType] = useState<Account["accountType"]>("asset");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await createAccount(tenantId, {
            accountNumber,
            name,
            accountType,
            description: description || undefined,
        });
        if (result.success) {
            onSuccess();
            onClose();
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">New Account</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Account # *</label>
                            <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none" required />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1 block">Type *</label>
                            <select value={accountType} onChange={(e) => setAccountType(e.target.value as Account["accountType"])} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                                <option value="asset">Asset</option>
                                <option value="liability">Liability</option>
                                <option value="equity">Equity</option>
                                <option value="revenue">Revenue</option>
                                <option value="expense">Expense</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Name *</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 outline-none" required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" rows={2} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
                        <button type="submit" disabled={saving || !accountNumber.trim() || !name.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ============================================================================
// PROFIT & LOSS TAB
// ============================================================================

interface ReportRow {
    accountId: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    balance: number;
}

function ProfitLossTab({ tenantId }: { tenantId: string }) {
    const today = new Date().toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const [fromDate, setFromDate] = useState(yearStart);
    const [toDate, setToDate] = useState(today);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        const result = await getProfitAndLoss(tenantId, fromDate, toDate);
        if (result.success && result.data) {
            setRows(result.data);
        }
        setLoading(false);
    }, [tenantId, fromDate, toDate]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const revenueRows = rows.filter(r => r.accountType === 'revenue');
    const expenseRows = rows.filter(r => r.accountType === 'expense');
    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    const fmt = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Date Range Picker */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">From</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">To</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No posted transactions for this period</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account #</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account Name</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Amount (₪)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {/* Revenue */}
                            <tr className="bg-emerald-500/5">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-emerald-600 text-xs uppercase tracking-wide">Revenue</td>
                            </tr>
                            {revenueRows.map(r => (
                                <tr key={r.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-mono text-xs pl-8">{r.accountNumber}</td>
                                    <td className="px-4 py-2">{r.accountName}</td>
                                    <td className="px-4 py-2 text-end font-mono text-emerald-600">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            <tr className="bg-emerald-500/10 font-semibold">
                                <td colSpan={2} className="px-4 py-2 text-end">Total Revenue</td>
                                <td className="px-4 py-2 text-end font-mono text-emerald-600">{fmt(totalRevenue)}</td>
                            </tr>

                            {/* Expenses */}
                            <tr className="bg-red-500/5">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-red-600 text-xs uppercase tracking-wide">Expenses</td>
                            </tr>
                            {expenseRows.map(r => (
                                <tr key={r.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-mono text-xs pl-8">{r.accountNumber}</td>
                                    <td className="px-4 py-2">{r.accountName}</td>
                                    <td className="px-4 py-2 text-end font-mono text-red-600">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            <tr className="bg-red-500/10 font-semibold">
                                <td colSpan={2} className="px-4 py-2 text-end">Total Expenses</td>
                                <td className="px-4 py-2 text-end font-mono text-red-600">{fmt(totalExpenses)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Net Income Footer */}
                    <div className={`px-4 py-3 border-t-2 flex justify-between items-center font-bold ${netIncome >= 0 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' : 'border-red-500 bg-red-500/10 text-red-700'}`}>
                        <span>Net Income</span>
                        <span className="font-mono">₪ {fmt(netIncome)}</span>
                    </div>
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
                Profit &amp; Loss for {fromDate} — {toDate}
            </p>
        </div>
    );
}

// ============================================================================
// BALANCE SHEET TAB
// ============================================================================

function BalanceSheetTab({ tenantId }: { tenantId: string }) {
    const today = new Date().toISOString().split('T')[0];

    const [asOfDate, setAsOfDate] = useState(today);
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        const result = await getBalanceSheet(tenantId, asOfDate);
        if (result.success && result.data) {
            setRows(result.data);
        }
        setLoading(false);
    }, [tenantId, asOfDate]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const assetRows = rows.filter(r => r.accountType === 'asset');
    const liabilityRows = rows.filter(r => r.accountType === 'liability');
    const equityRows = rows.filter(r => r.accountType === 'equity');
    const totalAssets = assetRows.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = liabilityRows.reduce((sum, r) => sum + r.balance, 0);
    const totalEquity = equityRows.reduce((sum, r) => sum + r.balance, 0);
    const liabPlusEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - liabPlusEquity) < 0.01;

    const fmt = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">As of</label>
                <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Scale className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No posted transactions to date</p>
                </div>
            ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account #</th>
                                <th className="text-start px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Account Name</th>
                                <th className="text-end px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Balance (₪)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {/* Assets */}
                            <tr className="bg-blue-500/5">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-blue-600 text-xs uppercase tracking-wide">Assets</td>
                            </tr>
                            {assetRows.map(r => (
                                <tr key={r.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-mono text-xs pl-8">{r.accountNumber}</td>
                                    <td className="px-4 py-2">{r.accountName}</td>
                                    <td className="px-4 py-2 text-end font-mono text-blue-600">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            <tr className="bg-blue-500/10 font-semibold">
                                <td colSpan={2} className="px-4 py-2 text-end">Total Assets</td>
                                <td className="px-4 py-2 text-end font-mono text-blue-600">{fmt(totalAssets)}</td>
                            </tr>

                            {/* Liabilities */}
                            <tr className="bg-amber-500/5">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-amber-600 text-xs uppercase tracking-wide">Liabilities</td>
                            </tr>
                            {liabilityRows.map(r => (
                                <tr key={r.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-mono text-xs pl-8">{r.accountNumber}</td>
                                    <td className="px-4 py-2">{r.accountName}</td>
                                    <td className="px-4 py-2 text-end font-mono text-amber-600">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            <tr className="bg-amber-500/10 font-semibold">
                                <td colSpan={2} className="px-4 py-2 text-end">Total Liabilities</td>
                                <td className="px-4 py-2 text-end font-mono text-amber-600">{fmt(totalLiabilities)}</td>
                            </tr>

                            {/* Equity */}
                            <tr className="bg-purple-500/5">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-purple-600 text-xs uppercase tracking-wide">Equity</td>
                            </tr>
                            {equityRows.map(r => (
                                <tr key={r.accountId} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-mono text-xs pl-8">{r.accountNumber}</td>
                                    <td className="px-4 py-2">{r.accountName}</td>
                                    <td className="px-4 py-2 text-end font-mono text-purple-600">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            <tr className="bg-purple-500/10 font-semibold">
                                <td colSpan={2} className="px-4 py-2 text-end">Total Equity</td>
                                <td className="px-4 py-2 text-end font-mono text-purple-600">{fmt(totalEquity)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Accounting Equation Footer */}
                    <div className={`px-4 py-3 border-t-2 flex justify-between items-center font-bold ${isBalanced ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' : 'border-red-500 bg-red-500/10 text-red-700'}`}>
                        <span>
                            {isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
                            <span className="text-xs font-normal ml-2 opacity-70">Assets = Liabilities + Equity</span>
                        </span>
                        <span className="font-mono">
                            ₪ {fmt(totalAssets)} = ₪ {fmt(liabPlusEquity)}
                        </span>
                    </div>
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
                Balance Sheet as of {asOfDate}
            </p>
        </div>
    );
}
