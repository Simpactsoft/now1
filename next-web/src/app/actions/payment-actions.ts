"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, ActionResult } from "./_shared/auth-utils";
import {
    validateSchema,
    uuidSchema,
    createPaymentSchema,
    updatePaymentSchema,
    paymentAllocationSchema,
} from "./_shared/schemas";
import { z } from "zod";

// ============================================================================
// PAYMENT ACTIONS
// ============================================================================

export async function getPayments(
    tenantId: string,
    paymentType?: string,
    status?: string
): Promise<ActionResult<unknown[]>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    let query = admin
        .from("payments")
        .select("*, payment_allocations(id, invoice_id, po_id, amount)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (paymentType) query = query.eq("payment_type", paymentType);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
}

export async function getPayment(tenantId: string, paymentId: string): Promise<ActionResult<unknown>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const idCheck = validateSchema(uuidSchema, paymentId);
    if (!idCheck.success) return { success: false, error: idCheck.error };

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("payments")
        .select("*, payment_allocations(id, invoice_id, po_id, amount)")
        .eq("id", paymentId)
        .eq("tenant_id", tenantId)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function createPayment(
    tenantId: string,
    input: z.infer<typeof createPaymentSchema>
): Promise<ActionResult<{ id: string; paymentNumber: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const v = validateSchema(createPaymentSchema, input);
    if (!v.success) return { success: false, error: v.error };

    const admin = createAdminClient();

    // Generate payment number
    const { data: numData, error: numErr } = await admin.rpc("generate_document_number", {
        p_tenant_id: tenantId,
        p_document_type: "payment",
    });
    if (numErr) return { success: false, error: numErr.message };
    const paymentNumber = numData as string;

    const { data, error } = await admin
        .from("payments")
        .insert({
            tenant_id: tenantId,
            payment_number: paymentNumber,
            payment_type: v.data.paymentType,
            entity_type: v.data.entityType,
            entity_id: v.data.entityId,
            payment_date: v.data.paymentDate ?? new Date().toISOString().split("T")[0],
            payment_method: v.data.paymentMethod,
            amount: v.data.amount,
            currency: v.data.currency ?? "ILS",
            reference: v.data.reference,
            notes: v.data.notes,
            created_by: auth.userId,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id, paymentNumber } };
}

export async function updatePayment(
    tenantId: string,
    paymentId: string,
    input: z.infer<typeof updatePaymentSchema>
): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const v = validateSchema(updatePaymentSchema, input);
    if (!v.success) return { success: false, error: v.error };

    const admin = createAdminClient();

    // Only draft payments can be edited
    const { data: existing } = await admin
        .from("payments")
        .select("status")
        .eq("id", paymentId)
        .eq("tenant_id", tenantId)
        .single();

    if (!existing) return { success: false, error: "Payment not found" };
    if (existing.status !== "draft") return { success: false, error: "Can only edit draft payments" };

    const updateData: Record<string, unknown> = {};
    if (v.data.amount !== undefined) updateData.amount = v.data.amount;
    if (v.data.paymentMethod !== undefined) updateData.payment_method = v.data.paymentMethod;
    if (v.data.paymentDate !== undefined) updateData.payment_date = v.data.paymentDate;
    if (v.data.reference !== undefined) updateData.reference = v.data.reference;
    if (v.data.notes !== undefined) updateData.notes = v.data.notes;

    const { error } = await admin
        .from("payments")
        .update(updateData)
        .eq("id", paymentId)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ============================================================================
// ALLOCATION ACTIONS
// ============================================================================

export async function addPaymentAllocation(
    tenantId: string,
    paymentId: string,
    input: z.infer<typeof paymentAllocationSchema>
): Promise<ActionResult<{ id: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const v = validateSchema(paymentAllocationSchema, input);
    if (!v.success) return { success: false, error: v.error };

    if (!v.data.invoiceId && !v.data.poId) {
        return { success: false, error: "Allocation must reference an invoice or PO" };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("payment_allocations")
        .insert({
            tenant_id: tenantId,
            payment_id: paymentId,
            invoice_id: v.data.invoiceId ?? null,
            po_id: v.data.poId ?? null,
            amount: v.data.amount,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
}

export async function removePaymentAllocation(
    tenantId: string,
    allocationId: string
): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { error } = await admin
        .from("payment_allocations")
        .delete()
        .eq("id", allocationId)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ============================================================================
// RPC WRAPPERS
// ============================================================================

export async function postPayment(tenantId: string, paymentId: string): Promise<ActionResult<{ journalEntryId: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("post_payment", { p_payment_id: paymentId });
    if (error) return { success: false, error: error.message };
    return { success: true, data: { journalEntryId: data as string } };
}

export async function voidPayment(tenantId: string, paymentId: string): Promise<ActionResult<{ journalEntryId: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("void_payment", { p_payment_id: paymentId });
    if (error) return { success: false, error: error.message };
    return { success: true, data: { journalEntryId: data as string } };
}

// ============================================================================
// OUTSTANDING DOCUMENTS (for allocation UI)
// ============================================================================

export async function getEntityOutstandingDocuments(
    tenantId: string,
    entityType: "customer" | "vendor",
    entityId: string
): Promise<ActionResult<unknown[]>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();

    if (entityType === "customer") {
        // Fetch unpaid/partially paid invoices
        const { data, error } = await admin
            .from("invoices")
            .select("id, invoice_number, total_amount, amount_paid, balance_due, status, issue_date")
            .eq("tenant_id", tenantId)
            .eq("customer_id", entityId)
            .in("status", ["issued"])
            .gt("balance_due", 0)
            .order("issue_date");

        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
    } else {
        // Fetch approved/partial POs for vendor
        const { data, error } = await admin
            .from("purchase_orders")
            .select("id, po_number, total, status, order_date")
            .eq("tenant_id", tenantId)
            .eq("vendor_id", entityId)
            .in("status", ["approved", "received", "partial"])
            .order("order_date");

        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
    }
}
