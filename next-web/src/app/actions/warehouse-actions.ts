"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError, ActionResult } from "./_shared/auth-utils";

// ============================================================================
// TYPES
// ============================================================================

interface Warehouse {
    id: string;
    code: string;
    name: string;
    address: string | null;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
}

interface WarehouseStock {
    productId: string;
    sku: string;
    productName: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
}

interface Transfer {
    id: string;
    transferNumber: number;
    fromWarehouseId: string;
    fromWarehouseCode: string;
    toWarehouseId: string;
    toWarehouseCode: string;
    productId: string;
    productSku: string;
    productName: string;
    quantity: number;
    status: string;
    notes: string | null;
    completedAt: string | null;
    createdAt: string;
}

// ============================================================================
// WAREHOUSE CRUD
// ============================================================================

export async function getWarehouses(
    tenantId: string
): Promise<ActionResult<Warehouse[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient
            .from("warehouses")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("is_default", { ascending: false })
            .order("code");

        if (error) return { success: false, error: error.message };

        const warehouses: Warehouse[] = (data || []).map((w: Record<string, unknown>) => ({
            id: w.id as string,
            code: w.code as string,
            name: w.name as string,
            address: w.address as string | null,
            isActive: w.is_active as boolean,
            isDefault: w.is_default as boolean,
            createdAt: w.created_at as string,
        }));

        return { success: true, data: warehouses };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function createWarehouse(
    tenantId: string,
    data: { code: string; name: string; address?: string; isDefault?: boolean }
): Promise<ActionResult<string>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data: whId, error } = await adminClient.rpc("create_warehouse", {
            p_tenant_id: tenantId,
            p_code: data.code,
            p_name: data.name,
            p_address: data.address || null,
            p_is_default: data.isDefault || false,
        });

        if (error) return { success: false, error: error.message };
        return { success: true, data: whId as string };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function updateWarehouse(
    tenantId: string,
    warehouseId: string,
    data: { code?: string; name?: string; address?: string; isActive?: boolean }
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const updates: Record<string, unknown> = {};
        if (data.code !== undefined) updates.code = data.code;
        if (data.name !== undefined) updates.name = data.name;
        if (data.address !== undefined) updates.address = data.address;
        if (data.isActive !== undefined) updates.is_active = data.isActive;

        const { error } = await adminClient
            .from("warehouses")
            .update(updates)
            .eq("id", warehouseId)
            .eq("tenant_id", tenantId);

        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function setDefaultWarehouse(
    tenantId: string,
    warehouseId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        // Unset current default
        await adminClient
            .from("warehouses")
            .update({ is_default: false })
            .eq("tenant_id", tenantId)
            .eq("is_default", true);

        // Set new default
        const { error } = await adminClient
            .from("warehouses")
            .update({ is_default: true })
            .eq("id", warehouseId)
            .eq("tenant_id", tenantId);

        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// WAREHOUSE STOCK
// ============================================================================

export async function getWarehouseStock(
    tenantId: string,
    warehouseId: string
): Promise<ActionResult<WarehouseStock[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data, error } = await adminClient.rpc("get_warehouse_stock", {
            p_tenant_id: tenantId,
            p_warehouse_id: warehouseId,
        });

        if (error) return { success: false, error: error.message };

        const stock: WarehouseStock[] = (data || []).map((r: Record<string, unknown>) => ({
            productId: r.product_id as string,
            sku: r.sku as string,
            productName: r.product_name as string,
            quantityOnHand: parseFloat(r.quantity_on_hand as string) || 0,
            quantityReserved: parseFloat(r.quantity_reserved as string) || 0,
            quantityAvailable: parseFloat(r.quantity_available as string) || 0,
        }));

        return { success: true, data: stock };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

// ============================================================================
// TRANSFERS
// ============================================================================

export async function getTransfers(
    tenantId: string,
    statusFilter?: string
): Promise<ActionResult<Transfer[]>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        let query = adminClient
            .from("warehouse_transfers")
            .select(`
                *,
                from_wh:warehouses!warehouse_transfers_from_warehouse_id_fkey(code),
                to_wh:warehouses!warehouse_transfers_to_warehouse_id_fkey(code),
                product:products!warehouse_transfers_product_id_fkey(sku, name)
            `)
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

        if (statusFilter) {
            query = query.eq("status", statusFilter);
        }

        const { data, error } = await query;

        if (error) return { success: false, error: error.message };

        const transfers: Transfer[] = (data || []).map((t: Record<string, unknown>) => {
            const fromWh = t.from_wh as Record<string, string> | null;
            const toWh = t.to_wh as Record<string, string> | null;
            const product = t.product as Record<string, string> | null;
            return {
                id: t.id as string,
                transferNumber: t.transfer_number as number,
                fromWarehouseId: t.from_warehouse_id as string,
                fromWarehouseCode: fromWh?.code || '—',
                toWarehouseId: t.to_warehouse_id as string,
                toWarehouseCode: toWh?.code || '—',
                productId: t.product_id as string,
                productSku: product?.sku || '—',
                productName: product?.name || '—',
                quantity: parseFloat(t.quantity as string) || 0,
                status: t.status as string,
                notes: t.notes as string | null,
                completedAt: t.completed_at as string | null,
                createdAt: t.created_at as string,
            };
        });

        return { success: true, data: transfers };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function createTransfer(
    tenantId: string,
    data: { fromWarehouseId: string; toWarehouseId: string; productId: string; quantity: number; notes?: string }
): Promise<ActionResult<string>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { data: result, error } = await adminClient
            .from("warehouse_transfers")
            .insert({
                tenant_id: tenantId,
                from_warehouse_id: data.fromWarehouseId,
                to_warehouse_id: data.toWarehouseId,
                product_id: data.productId,
                quantity: data.quantity,
                notes: data.notes || null,
                requested_by: auth.userId,
            })
            .select("id")
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: result.id };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}

export async function executeTransfer(
    tenantId: string,
    transferId: string
): Promise<ActionResult<null>> {
    try {
        const auth = await verifyAuthWithTenant(tenantId);
        if (isAuthError(auth)) return { success: false, error: auth.error };

        const adminClient = createAdminClient();

        const { error } = await adminClient.rpc("execute_warehouse_transfer", {
            p_transfer_id: transferId,
            p_executed_by: auth.userId,
        });

        if (error) return { success: false, error: error.message };
        return { success: true, data: null };
    } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
    }
}
