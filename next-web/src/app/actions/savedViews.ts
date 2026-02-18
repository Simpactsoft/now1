"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ActionResult, actionSuccess, actionOk, actionError } from "@/lib/action-result";

export interface SavedView {
    id: string;
    tenant_id: string;
    name: string;
    config: any; // { filterModel, sortModel, viewMode }
    created_at: string;
}

export async function getSavedViews(tenantId: string): Promise<ActionResult<SavedView[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('saved_views')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('name', { ascending: true });

        if (error) throw error;
        return actionSuccess(data as SavedView[]);
    } catch (e: any) {
        console.error("getSavedViews Error:", e);
        return actionError(e.message);
    }
}

export async function saveView(tenantId: string, name: string, config: any): Promise<ActionResult<SavedView>> {
    try {
        const supabase = await createClient();

        const user = await supabase.auth.getUser();
        console.log("[saveView] User:", user.data.user?.id || "ANONYMOUS", "Role:", user.data.user?.role);
        console.log("[saveView] Tenant:", tenantId);

        // Upsert by triggering unique constraint logic or just check existence?
        // Let's use upsert based on constraint (tenant_id, name) if we want overwrite,
        // OR insert and catch error for duplicate.
        // For better UX, upsert is often nicer if user confirms "Overwrite",
        // but simple "Save" usually implies new.
        // Let's do simple INSERT for now, UI will handle conflicts (or DB error).

        const { data, error } = await supabase
            .from('saved_views')
            .insert({
                tenant_id: tenantId,
                name: name,
                config: config
            })
            .select()
            .single();

        if (error) {
            console.error("[saveView] Insert Error:", error);
            // Check for unique violation
            if (error.code === '23505') { // unique_violation
                return actionError("A view with this name already exists.", "CONFLICT");
            }
            throw error;
        }

        revalidatePath('/dashboard/people');
        return actionSuccess(data as SavedView);
    } catch (e: any) {
        console.error("saveView Error:", e);
        return actionError(e.message);
    }
}

export async function updateViewConfig(id: string, config: any): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('saved_views')
            .update({ config, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/dashboard/people');
        return actionOk();
    } catch (e: any) {
        return actionError(e.message);
    }
}

export async function renameView(id: string, newName: string): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('saved_views')
            .update({ name: newName, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            if (error.code === '23505') {
                return actionError("Name already taken.", "CONFLICT");
            }
            throw error;
        }
        revalidatePath('/dashboard/people');
        return actionOk();
    } catch (e: any) {
        return actionError(e.message);
    }
}

export async function deleteView(id: string): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('saved_views')
            .delete()
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/dashboard/people');
        return actionOk();
    } catch (e: any) {
        return actionError(e.message);
    }
}
