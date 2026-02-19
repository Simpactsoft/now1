"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth, verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, type ActionResult } from "./_shared/auth-utils";
import { validateMarginSchema, marginActionSchema, validateSchema } from "./_shared/schemas";

// ============================================================================
// TYPES
// ============================================================================

interface MarginValidation {
    marginPct: number;
    minRequired: number;
    isBelowMinimum: boolean;
    requiresApproval: boolean;
    approvalId: string | null;
}

interface MarginApproval {
    id: string;
    quoteId: string;
    marginPct: number;
    minRequired: number;
    status: 'pending' | 'approved' | 'rejected';
    requestedBy: string | null;
    approvedBy: string | null;
    notes: string | null;
    requestedAt: string;
    resolvedAt: string | null;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Validate quote margin against tenant minimum.
 * Auto-creates approval request if below threshold.
 */
export async function validateQuoteMargin(
    quoteId: string
): Promise<ActionResult<MarginValidation>> {
    try {
        // Zod validation
        const v = validateSchema(validateMarginSchema, { quoteId });
        if (!v.success) return { success: false, error: v.error };

        const auth = await verifyAuth();
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Verify caller owns this quote's tenant
        const { data: quote } = await adminClient
            .from("quotes")
            .select("tenant_id")
            .eq("id", quoteId)
            .single();

        if (!quote) return { success: false, error: "Quote not found" };

        // Verify tenant membership
        const tenantAuth = await verifyAuthWithTenant(quote.tenant_id);
        if (isAuthError(tenantAuth)) return { success: false, error: tenantAuth.error };

        const { data, error } = await adminClient.rpc("validate_quote_margin", {
            p_quote_id: quoteId,
        });

        if (error) return { success: false, error: error.message };

        if (!data || data.length === 0) {
            return { success: false, error: "Validation returned no result" };
        }

        const row = data[0];
        return {
            success: true,
            data: {
                marginPct: parseFloat(row.margin_pct),
                minRequired: parseFloat(row.min_required),
                isBelowMinimum: row.is_below_minimum,
                requiresApproval: row.requires_approval,
                approvalId: row.approval_id,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Approve a low-margin quote.
 */
export async function approveMarginException(
    quoteId: string,
    notes?: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuth();
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Verify caller owns this quote's tenant
        const { data: quote } = await adminClient
            .from("quotes")
            .select("tenant_id")
            .eq("id", quoteId)
            .single();

        if (!quote) return { success: false, error: "Quote not found" };

        const tenantAuth = await verifyAuthWithTenant(quote.tenant_id);
        if (isAuthError(tenantAuth)) return { success: false, error: tenantAuth.error };

        const { error } = await adminClient.rpc("approve_margin", {
            p_quote_id: quoteId,
            p_approver_id: auth.userId,
            p_notes: notes || null,
        });

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Reject a low-margin quote.
 */
export async function rejectMarginException(
    quoteId: string,
    notes?: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuth();
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Verify caller owns this quote's tenant
        const { data: quote } = await adminClient
            .from("quotes")
            .select("tenant_id")
            .eq("id", quoteId)
            .single();

        if (!quote) return { success: false, error: "Quote not found" };

        const tenantAuth = await verifyAuthWithTenant(quote.tenant_id);
        if (isAuthError(tenantAuth)) return { success: false, error: tenantAuth.error };

        const { error } = await adminClient.rpc("reject_margin", {
            p_quote_id: quoteId,
            p_rejector_id: auth.userId,
            p_notes: notes || null,
        });

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

/**
 * Get pending margin approvals for the current tenant.
 */
export async function getPendingApprovals(
    tenantId: string
): Promise<ActionResult<MarginApproval[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("margin_approvals")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("status", "pending")
            .order("requested_at", { ascending: false });

        if (error) return { success: false, error: error.message };

        const approvals: MarginApproval[] = (data || []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            quoteId: a.quote_id as string,
            marginPct: parseFloat(a.margin_pct as string),
            minRequired: parseFloat(a.min_required as string),
            status: a.status as MarginApproval['status'],
            requestedBy: a.requested_by as string | null,
            approvedBy: a.approved_by as string | null,
            notes: a.notes as string | null,
            requestedAt: a.requested_at as string,
            resolvedAt: a.resolved_at as string | null,
        }));

        return { success: true, data: approvals };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
