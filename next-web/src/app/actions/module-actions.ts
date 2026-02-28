"use server";

import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

// ============================================================================
// Types
// ============================================================================

export interface ModuleDefinition {
    key: string;
    display_name_en: string;
    display_name_he: string;
    category: string;
    default_enabled: boolean;
    sort_order: number;
    description_he: string | null;
    is_enabled: boolean;
    has_override: boolean;
    disabled_by: string | null;
    disabled_at: string | null;
}

// ============================================================================
// Get modules for a specific tenant (admin view)
// ============================================================================

export async function getTenantModules(
    tenantId: string
): Promise<ActionResult<ModuleDefinition[]>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_tenant_modules", {
        p_tenant_id: tenantId,
    });

    if (error) {
        console.error("[getTenantModules] RPC error:", error);
        return actionError(error.message, "DB_ERROR");
    }

    return actionSuccess((data as ModuleDefinition[]) || []);
}

// ============================================================================
// Toggle a module for a specific tenant
// ============================================================================

export async function updateTenantModule(
    tenantId: string,
    moduleKey: string,
    isEnabled: boolean
): Promise<ActionResult<{ module_key: string; is_enabled: boolean }>> {
    const auth = await verifyAuthWithTenant(tenantId);
    if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

    // 1. Get user details directly from auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if system admin
    const isSystemAdmin = user?.app_metadata?.app_role === 'admin' || user?.app_metadata?.app_role === 'super_admin';

    // 2. Check profile role if not a system admin
    let isAuthorized = isSystemAdmin;

    if (!isAuthorized) {
        const adminClient = createAdminClient();
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", auth.userId)
            .single();

        isAuthorized = !!profile && ["distributor", "dealer"].includes(profile.role);
    }

    if (!isAuthorized) {
        return actionError("Permission denied: requires system admin, distributor, or dealer role", "AUTH_ERROR");
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc("toggle_tenant_module", {
        p_tenant_id: tenantId,
        p_module_key: moduleKey,
        p_enabled: isEnabled,
        p_user_id: auth.userId,
    });

    if (error) {
        console.error("[updateTenantModule] RPC error:", error);
        return actionError(error.message, "DB_ERROR");
    }

    return actionSuccess({
        module_key: moduleKey,
        is_enabled: isEnabled,
    });
}

// ============================================================================
// Get enabled modules for current user's tenant (for sidebar/routing)
// ============================================================================

export async function getEnabledModules(): Promise<ActionResult<string[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("get_enabled_modules");

        if (error) {
            console.error("[getEnabledModules] RPC error:", error);
            // Fallback: return all modules as enabled if RPC fails
            // This prevents breaking the app if migration hasn't been applied
            return actionSuccess([]);
        }

        return actionSuccess((data as string[]) || []);
    } catch (e: unknown) {
        console.error("[getEnabledModules] Error:", e);
        return actionSuccess([]);
    }
}
