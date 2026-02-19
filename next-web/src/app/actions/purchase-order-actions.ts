"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, ActionResult } from "./_shared/auth-utils";
import {
    validateSchema,
    uuidSchema,
    createVendorSchema,
    updateVendorSchema,
    createPurchaseOrderSchema,
    updatePurchaseOrderSchema,
    purchaseOrderItemSchema,
    receiveItemSchema,
} from "./_shared/schemas";
import { z } from "zod";

// ============================================================================
// VENDOR ACTIONS
// ============================================================================

export async function getVendors(tenantId: string): Promise<ActionResult<unknown[]>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("vendors")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
}

export async function createVendor(
    tenantId: string,
    input: z.infer<typeof createVendorSchema>
): Promise<ActionResult<{ id: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const v = validateSchema(createVendorSchema, input);
    if (!v.success) return { success: false, error: v.error };

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("vendors")
        .insert({
            tenant_id: tenantId,
            name: v.data.name,
            contact_name: v.data.contactName,
            email: v.data.email,
            phone: v.data.phone,
            address_line1: v.data.addressLine1,
            address_line2: v.data.addressLine2,
            city: v.data.city,
            country: v.data.country,
            tax_id: v.data.taxId,
            payment_terms_days: v.data.paymentTermsDays ?? 30,
            notes: v.data.notes,
            is_active: v.data.isActive ?? true,
        })
        .select("id")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
}

export async function updateVendor(
    tenantId: string,
    vendorId: string,
    input: z.infer<typeof updateVendorSchema>
): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const idCheck = validateSchema(uuidSchema, vendorId);
    if (!idCheck.success) return { success: false, error: idCheck.error };

    const v = validateSchema(updateVendorSchema, input);
    if (!v.success) return { success: false, error: v.error };

    const updateData: Record<string, unknown> = {};
    if (v.data.name !== undefined) updateData.name = v.data.name;
    if (v.data.contactName !== undefined) updateData.contact_name = v.data.contactName;
    if (v.data.email !== undefined) updateData.email = v.data.email;
    if (v.data.phone !== undefined) updateData.phone = v.data.phone;
    if (v.data.addressLine1 !== undefined) updateData.address_line1 = v.data.addressLine1;
    if (v.data.addressLine2 !== undefined) updateData.address_line2 = v.data.addressLine2;
    if (v.data.city !== undefined) updateData.city = v.data.city;
    if (v.data.country !== undefined) updateData.country = v.data.country;
    if (v.data.taxId !== undefined) updateData.tax_id = v.data.taxId;
    if (v.data.paymentTermsDays !== undefined) updateData.payment_terms_days = v.data.paymentTermsDays;
    if (v.data.notes !== undefined) updateData.notes = v.data.notes;
    if (v.data.isActive !== undefined) updateData.is_active = v.data.isActive;

    const admin = createAdminClient();
    const { error } = await admin
        .from("vendors")
        .update(updateData)
        .eq("id", vendorId)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ============================================================================
// PURCHASE ORDER ACTIONS
// ============================================================================

export async function getPurchaseOrders(tenantId: string, status?: string): Promise<ActionResult<unknown[]>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    let query = admin
        .from("purchase_orders")
        .select("*, vendors(id, name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (status && status !== "all") {
        query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
}

export async function getPurchaseOrder(tenantId: string, poId: string): Promise<ActionResult<unknown>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const idCheck = validateSchema(uuidSchema, poId);
    if (!idCheck.success) return { success: false, error: idCheck.error };

    const admin = createAdminClient();
    const { data: po, error } = await admin
        .from("purchase_orders")
        .select("*, vendors(id, name), purchase_order_items(*)")
        .eq("id", poId)
        .eq("tenant_id", tenantId)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: po };
}

export async function createPurchaseOrder(
    tenantId: string,
    input: z.infer<typeof createPurchaseOrderSchema>,
    items: z.infer<typeof purchaseOrderItemSchema>[]
): Promise<ActionResult<{ id: string; poNumber: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const v = validateSchema(createPurchaseOrderSchema, input);
    if (!v.success) return { success: false, error: v.error };

    // Validate items
    const itemsSchema = z.array(purchaseOrderItemSchema).min(1, "At least one item is required");
    const iv = validateSchema(itemsSchema, items);
    if (!iv.success) return { success: false, error: iv.error };

    const admin = createAdminClient();

    // Generate PO number
    const { data: numData, error: numErr } = await admin.rpc("generate_document_number", {
        p_tenant_id: tenantId,
        p_document_type: "po",
    });
    if (numErr) return { success: false, error: numErr.message };
    const poNumber = numData as string;

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of iv.data) {
        const lineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        const lineTax = Math.round(lineTotal * (item.taxRate ?? 0) * 100) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
    }
    const total = subtotal + taxAmount;

    // Insert PO header
    const { data: po, error: poErr } = await admin
        .from("purchase_orders")
        .insert({
            tenant_id: tenantId,
            po_number: poNumber,
            vendor_id: v.data.vendorId,
            order_date: v.data.orderDate ?? new Date().toISOString().split("T")[0],
            expected_delivery_date: v.data.expectedDeliveryDate,
            warehouse_id: v.data.warehouseId,
            tax_zone_id: v.data.taxZoneId,
            subtotal,
            tax_amount: taxAmount,
            total,
            currency: v.data.currency ?? "ILS",
            notes: v.data.notes,
            created_by: auth.userId,
        })
        .select("id")
        .single();

    if (poErr) return { success: false, error: poErr.message };

    // Insert items
    const poItems = iv.data.map((item) => ({
        po_id: po.id,
        tenant_id: tenantId,
        product_id: item.productId ?? null,
        variant_id: item.variantId ?? null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate ?? 0,
    }));

    const { error: itemsErr } = await admin.from("purchase_order_items").insert(poItems);
    if (itemsErr) return { success: false, error: itemsErr.message };

    return { success: true, data: { id: po.id, poNumber } };
}

export async function updatePurchaseOrder(
    tenantId: string,
    poId: string,
    input: z.infer<typeof updatePurchaseOrderSchema>
): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const idCheck = validateSchema(uuidSchema, poId);
    if (!idCheck.success) return { success: false, error: idCheck.error };

    const v = validateSchema(updatePurchaseOrderSchema, input);
    if (!v.success) return { success: false, error: v.error };

    // Only allow editing drafts
    const admin = createAdminClient();
    const { data: existing } = await admin
        .from("purchase_orders")
        .select("status")
        .eq("id", poId)
        .eq("tenant_id", tenantId)
        .single();

    if (!existing) return { success: false, error: "PO not found" };
    if (existing.status !== "draft") return { success: false, error: "Can only edit draft POs" };

    const updateData: Record<string, unknown> = {};
    if (v.data.vendorId !== undefined) updateData.vendor_id = v.data.vendorId;
    if (v.data.orderDate !== undefined) updateData.order_date = v.data.orderDate;
    if (v.data.expectedDeliveryDate !== undefined) updateData.expected_delivery_date = v.data.expectedDeliveryDate;
    if (v.data.warehouseId !== undefined) updateData.warehouse_id = v.data.warehouseId;
    if (v.data.taxZoneId !== undefined) updateData.tax_zone_id = v.data.taxZoneId;
    if (v.data.currency !== undefined) updateData.currency = v.data.currency;
    if (v.data.notes !== undefined) updateData.notes = v.data.notes;

    const { error } = await admin
        .from("purchase_orders")
        .update(updateData)
        .eq("id", poId)
        .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ============================================================================
// PO LIFECYCLE RPC WRAPPERS
// ============================================================================

export async function submitPurchaseOrder(tenantId: string, poId: string): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { error } = await admin.rpc("submit_purchase_order", { p_po_id: poId });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function approvePurchaseOrder(tenantId: string, poId: string): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { error } = await admin.rpc("approve_purchase_order", {
        p_po_id: poId,
        p_approved_by: auth.userId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function receivePurchaseOrder(
    tenantId: string,
    poId: string,
    items: z.infer<typeof receiveItemSchema>[]
): Promise<ActionResult<{ journalEntryId: string }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const itemsArr = z.array(receiveItemSchema).min(1);
    const v = validateSchema(itemsArr, items);
    if (!v.success) return { success: false, error: v.error };

    // Convert to the JSONB format expected by the RPC
    const rpcItems = v.data.map((i) => ({ item_id: i.itemId, received_qty: i.receivedQty }));

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("receive_purchase_order", {
        p_po_id: poId,
        p_items: rpcItems,
        p_received_by: auth.userId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: { journalEntryId: data as string } };
}

export async function cancelPurchaseOrder(tenantId: string, poId: string): Promise<ActionResult<null>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return { success: false, error: auth.error };

    const admin = createAdminClient();
    const { error } = await admin.rpc("cancel_purchase_order", { p_po_id: poId });
    if (error) return { success: false, error: error.message };
    return { success: true };
}
