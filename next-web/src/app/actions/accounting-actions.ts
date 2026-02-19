"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAuth, verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, type ActionResult } from "./_shared/auth-utils";
import { createAccountSchema, createJournalEntrySchema, validateSchema } from "./_shared/schemas";

// ============================================================================
// TYPES
// ============================================================================

interface Account {
    id: string;
    tenantId: string;
    parentId: string | null;
    accountNumber: string;
    name: string;
    accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    description: string | null;
    isActive: boolean;
    isSystem: boolean;
    currency: string;
    normalBalance: 'debit' | 'credit';
}

interface JournalEntry {
    id: string;
    tenantId: string;
    entryNumber: number;
    entryDate: string;
    postedDate: string | null;
    status: 'draft' | 'posted' | 'voided';
    memo: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdBy: string | null;
    lines?: JournalLine[];
}

interface JournalLine {
    id: string;
    accountId: string;
    accountName?: string;
    accountNumber?: string;
    lineNumber: number;
    description: string | null;
    debit: number;
    credit: number;
}

interface TrialBalanceRow {
    accountId: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
}

interface ReportRow {
    accountId: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    balance: number;
}

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

/**
 * Get chart of accounts for a tenant (with optional pagination).
 */
export async function getChartOfAccounts(
    tenantId: string,
    pagination?: { page?: number; pageSize?: number }
): Promise<ActionResult<Account[]> & { totalCount?: number }> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Count total for pagination metadata
        const { count } = await adminClient
            .from("chart_of_accounts")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("is_active", true);

        let query = adminClient
            .from("chart_of_accounts")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("account_number");

        // Apply pagination if provided
        if (pagination?.page && pagination?.pageSize) {
            const from = (pagination.page - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            query = query.range(from, to);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };

        const accounts: Account[] = (data || []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            tenantId: a.tenant_id as string,
            parentId: a.parent_id as string | null,
            accountNumber: a.account_number as string,
            name: a.name as string,
            accountType: a.account_type as Account['accountType'],
            description: a.description as string | null,
            isActive: a.is_active as boolean,
            isSystem: a.is_system as boolean,
            currency: a.currency as string,
            normalBalance: a.normal_balance as Account['normalBalance'],
        }));

        return { success: true, data: accounts, totalCount: count ?? undefined };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Create a new account in the chart of accounts.
 */
export async function createAccount(
    tenantId: string,
    account: {
        accountNumber: string;
        name: string;
        accountType: Account['accountType'];
        parentId?: string;
        description?: string;
        currency?: string;
    }
): Promise<ActionResult<{ id: string }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(createAccountSchema, account);
        if (!v.success) return { success: false, error: v.error };

        const normalBalance = ['asset', 'expense'].includes(account.accountType) ? 'debit' : 'credit';

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("chart_of_accounts")
            .insert({
                tenant_id: tenantId,
                account_number: account.accountNumber.trim(),
                name: account.name.trim(),
                account_type: account.accountType,
                parent_id: account.parentId || null,
                description: account.description || null,
                currency: account.currency || 'ILS',
                normal_balance: normalBalance,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true, data: { id: data.id } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Seed the Israeli standard chart of accounts for a tenant.
 */
export async function seedILChartOfAccounts(
    tenantId: string
): Promise<ActionResult<{ accountCount: number }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("seed_il_chart_of_accounts", {
            p_tenant_id: tenantId,
        });

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true, data: { accountCount: data } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

/**
 * Get journal entries (with optional status filter and pagination).
 */
export async function getJournalEntries(
    tenantId: string,
    filters?: { status?: string; fromDate?: string; toDate?: string },
    pagination?: { page?: number; pageSize?: number }
): Promise<ActionResult<JournalEntry[]> & { totalCount?: number }> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Build count query with same filters
        let countQuery = adminClient
            .from("journal_entries")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId);
        if (filters?.status) countQuery = countQuery.eq("status", filters.status);
        if (filters?.fromDate) countQuery = countQuery.gte("entry_date", filters.fromDate);
        if (filters?.toDate) countQuery = countQuery.lte("entry_date", filters.toDate);
        const { count } = await countQuery;

        let query = adminClient
            .from("journal_entries")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("entry_date", { ascending: false });

        if (filters?.status) query = query.eq("status", filters.status);
        if (filters?.fromDate) query = query.gte("entry_date", filters.fromDate);
        if (filters?.toDate) query = query.lte("entry_date", filters.toDate);

        // Apply pagination or default limit
        if (pagination?.page && pagination?.pageSize) {
            const from = (pagination.page - 1) * pagination.pageSize;
            const to = from + pagination.pageSize - 1;
            query = query.range(from, to);
        } else {
            query = query.limit(100);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };

        const entries: JournalEntry[] = (data || []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            tenantId: e.tenant_id as string,
            entryNumber: e.entry_number as number,
            entryDate: e.entry_date as string,
            postedDate: e.posted_date as string | null,
            status: e.status as JournalEntry['status'],
            memo: e.memo as string | null,
            referenceType: e.reference_type as string | null,
            referenceId: e.reference_id as string | null,
            createdBy: e.created_by as string | null,
        }));

        return { success: true, data: entries, totalCount: count ?? undefined };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Create a journal entry with lines.
 */
export async function createJournalEntry(
    tenantId: string,
    entry: {
        entryDate?: string;
        memo?: string;
        referenceType?: string;
        referenceId?: string;
        lines: Array<{
            accountId: string;
            description?: string;
            debit: number;
            credit: number;
        }>;
    }
): Promise<ActionResult<{ id: string }>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        // Zod validation
        const v = validateSchema(createJournalEntrySchema, entry);
        if (!v.success) return { success: false, error: v.error };

        // Client-side balance check (RPC also validates)
        const totalDebits = entry.lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredits = entry.lines.reduce((sum, l) => sum + l.credit, 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            return { success: false, error: `Unbalanced: debits (${totalDebits}) != credits (${totalCredits})` };
        }

        const adminClient = createAdminClient();

        // Atomic RPC: creates header + lines in a single transaction
        const linesPayload = entry.lines.map((l) => ({
            account_id: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description || null,
        }));

        const { data: entryId, error } = await adminClient.rpc("create_journal_entry", {
            p_tenant_id: tenantId,
            p_date: entry.entryDate || new Date().toISOString().split('T')[0],
            p_memo: entry.memo || null,
            p_reference_type: entry.referenceType || 'manual',
            p_reference_id: entry.referenceId || null,
            p_created_by: auth.userId,
            p_lines: linesPayload,
        });

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true, data: { id: entryId } };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Post a journal entry (validates balance and posts).
 */
export async function postJournalEntry(
    entryId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuth();
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Verify caller owns this entry's tenant
        const { data: entry } = await adminClient
            .from("journal_entries")
            .select("tenant_id")
            .eq("id", entryId)
            .single();

        if (!entry) return { success: false, error: "Journal entry not found" };

        const tenantAuth = await verifyAuthWithTenant(entry.tenant_id);
        if (isAuthError(tenantAuth)) return { success: false, error: tenantAuth.error };

        const { error } = await adminClient.rpc("post_journal_entry", {
            p_entry_id: entryId,
            p_posted_by: auth.userId,
        });

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Void a posted journal entry.
 */
export async function voidJournalEntry(
    entryId: string,
    reason?: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuth();
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Verify caller owns this entry's tenant
        const { data: entry } = await adminClient
            .from("journal_entries")
            .select("tenant_id")
            .eq("id", entryId)
            .single();

        if (!entry) return { success: false, error: "Journal entry not found" };

        const tenantAuth = await verifyAuthWithTenant(entry.tenant_id);
        if (isAuthError(tenantAuth)) return { success: false, error: tenantAuth.error };

        const { error } = await adminClient.rpc("void_journal_entry", {
            p_entry_id: entryId,
            p_voided_by: auth.userId,
            p_reason: reason || null,
        });

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// REPORTS
// ============================================================================

/**
 * Get trial balance as of a specific date.
 */
export async function getTrialBalance(
    tenantId: string,
    asOfDate?: string
): Promise<ActionResult<TrialBalanceRow[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("get_trial_balance", {
            p_tenant_id: tenantId,
            p_as_of_date: asOfDate || new Date().toISOString().split('T')[0],
        });

        if (error) return { success: false, error: error.message };

        const rows: TrialBalanceRow[] = (data || []).map((r: Record<string, unknown>) => ({
            accountId: r.account_id as string,
            accountNumber: r.account_number as string,
            accountName: r.account_name as string,
            accountType: r.account_type as string,
            debitBalance: parseFloat(r.debit_balance as string) || 0,
            creditBalance: parseFloat(r.credit_balance as string) || 0,
        }));

        return { success: true, data: rows };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Get Profit & Loss report for a date range.
 */
export async function getProfitAndLoss(
    tenantId: string,
    fromDate: string,
    toDate: string
): Promise<ActionResult<ReportRow[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("get_profit_and_loss", {
            p_tenant_id: tenantId,
            p_from_date: fromDate,
            p_to_date: toDate,
        });

        if (error) return { success: false, error: error.message };

        const rows: ReportRow[] = (data || []).map((r: Record<string, unknown>) => ({
            accountId: r.account_id as string,
            accountNumber: r.account_number as string,
            accountName: r.account_name as string,
            accountType: r.account_type as string,
            balance: parseFloat(r.balance as string) || 0,
        }));

        return { success: true, data: rows };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Get Balance Sheet as of a specific date.
 */
export async function getBalanceSheet(
    tenantId: string,
    asOfDate?: string
): Promise<ActionResult<ReportRow[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("get_balance_sheet", {
            p_tenant_id: tenantId,
            p_as_of_date: asOfDate || new Date().toISOString().split('T')[0],
        });

        if (error) return { success: false, error: error.message };

        const rows: ReportRow[] = (data || []).map((r: Record<string, unknown>) => ({
            accountId: r.account_id as string,
            accountNumber: r.account_number as string,
            accountName: r.account_name as string,
            accountType: r.account_type as string,
            balance: parseFloat(r.balance as string) || 0,
        }));

        return { success: true, data: rows };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
