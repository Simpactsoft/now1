"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, ActionResult } from "./_shared/auth-utils";

// ============================================================================
// TYPES
// ============================================================================

interface Invoice {
    id: string;
    invoiceNumber: string | null;
    orderId: string | null;
    customerId: string | null;
    customerName: string | null;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    currency: string;
    notes: string | null;
    journalEntryId: string | null;
    createdAt: string;
}

interface InvoiceItem {
    id: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sortOrder: number;
}

// ============================================================================
// INVOICE CRUD
// ============================================================================

export async function getInvoices(
    tenantId: string,
    statusFilter?: string
): Promise<ActionResult<Invoice[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        let query = adminClient
            .from("invoices")
            .select(`
                *,
                customer:cards!invoices_tenant_id_customer_id_fkey(display_name)
            `)
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

        if (statusFilter) {
            query = query.eq("status", statusFilter);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };

        const invoices: Invoice[] = (data || []).map((inv: Record<string, unknown>) => {
            const customer = inv.customer as Record<string, string> | null;
            return {
                id: inv.id as string,
                invoiceNumber: inv.invoice_number as string | null,
                orderId: inv.order_id as string | null,
                customerId: inv.customer_id as string | null,
                customerName: customer?.display_name || null,
                status: inv.status as string,
                issueDate: inv.issue_date as string | null,
                dueDate: inv.due_date as string | null,
                subtotal: parseFloat(inv.subtotal as string) || 0,
                vatRate: parseFloat(inv.vat_rate as string) || 0,
                vatAmount: parseFloat(inv.vat_amount as string) || 0,
                totalAmount: parseFloat(inv.total_amount as string) || 0,
                currency: (inv.currency as string) || 'ILS',
                notes: inv.notes as string | null,
                journalEntryId: inv.journal_entry_id as string | null,
                createdAt: inv.created_at as string,
            };
        });

        return { success: true, data: invoices };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function getInvoiceItems(
    tenantId: string,
    invoiceId: string
): Promise<ActionResult<InvoiceItem[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", invoiceId)
            .eq("tenant_id", tenantId)
            .order("sort_order");

        if (error) return { success: false, error: error.message };

        const items: InvoiceItem[] = (data || []).map((item: Record<string, unknown>) => ({
            id: item.id as string,
            productId: item.product_id as string | null,
            description: item.description as string,
            quantity: parseFloat(item.quantity as string) || 0,
            unitPrice: parseFloat(item.unit_price as string) || 0,
            lineTotal: parseFloat(item.line_total as string) || 0,
            sortOrder: item.sort_order as number,
        }));

        return { success: true, data: items };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// INVOICE ACTIONS
// ============================================================================

export async function createInvoiceFromQuote(
    tenantId: string,
    orderId: string,
    vatRate?: number,
    notes?: string
): Promise<ActionResult<string>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("create_invoice_from_quote", {
            p_tenant_id: tenantId,
            p_order_id: orderId,
            p_issued_by: auth.userId,
            p_vat_rate: vatRate ?? 0.17,
            p_notes: notes || null,
        });

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as string };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function issueInvoice(
    tenantId: string,
    invoiceId: string
): Promise<ActionResult<string | null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("issue_invoice", {
            p_invoice_id: invoiceId,
            p_issued_by: auth.userId,
        });

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as string | null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function cancelInvoice(
    tenantId: string,
    invoiceId: string,
    reason?: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { error } = await adminClient.rpc("cancel_invoice", {
            p_invoice_id: invoiceId,
            p_reason: reason || null,
        });

        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function markInvoicePaid(
    tenantId: string,
    invoiceId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { error } = await adminClient
            .from("invoices")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", invoiceId)
            .eq("tenant_id", tenantId)
            .eq("status", "issued");

        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
