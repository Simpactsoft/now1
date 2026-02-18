"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuditLogEntry {
    id: string;
    templateId: string;
    userId: string | null;
    action: "INSERT" | "UPDATE" | "DELETE";
    entityType: "product_template" | "option_group" | "option" | "configuration_rule" | "template_preset";
    entityId: string;
    entityName: string | null;
    changes: Record<string, any>;
    createdAt: string;
}

export async function getAuditLog(
    templateId: string,
    options?: { page?: number; pageSize?: number }
): Promise<{
    success: boolean;
    data?: AuditLogEntry[];
    total?: number;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const page = options?.page || 1;
        const pageSize = options?.pageSize || 50;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from("cpq_audit_log")
            .select("*", { count: "exact" })
            .eq("template_id", templateId)
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            console.error("Error fetching audit log:", error);
            return { success: false, error: error.message };
        }

        const entries: AuditLogEntry[] = (data || []).map((row: any) => ({
            id: row.id,
            templateId: row.template_id,
            userId: row.user_id,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            entityName: row.entity_name,
            changes: row.changes || {},
            createdAt: row.created_at,
        }));

        return { success: true, data: entries, total: count || 0 };
    } catch (error: any) {
        console.error("Error in getAuditLog:", error);
        return { success: false, error: error.message };
    }
}
