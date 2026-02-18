"use server";

import { createClient } from "@/lib/supabase/server";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

export async function exportPeople(): Promise<ActionResult<{ csv: string }>> {
    const supabase = await createClient();

    try {
        // 1. RBAC Check: Explicitly check for export permission
        // We use the database function we created to ensure consistency
        const { data: hasPermission, error: permError } = await supabase
            .rpc('has_permission', { requested_permission: 'export.data' });

        if (permError) {
            console.error("Permission check failed:", permError);
            return actionError("Permission check failed", "AUTH_ERROR");
        }

        if (!hasPermission) {
            return actionError("Unauthorized: You do not have permission to export data.", "AUTH_ERROR");
        }

        // 2. Fetch Data (RLS applies here too, so they only see their own tenant's data)
        const { data: people, error: fetchError } = await supabase
            .from('cards')
            .select('id, display_name, contact_methods, custom_fields, status')
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error("Export fetch failed:", fetchError);
            return actionError(fetchError.message, "DB_ERROR");
        }

        // 3. Generate CSV
        const headers = ["ID", "Name", "Email", "Phone", "City", "Status", "Role", "Employer"];
        const rows = people.map((p: any) => {
            // Extract from JSONB
            let email = '';
            let phone = '';

            const cm = p.contact_methods;
            if (Array.isArray(cm)) {
                email = cm.find((m: any) => m.type === 'email')?.value || '';
                phone = cm.find((m: any) => m.type === 'phone')?.value || '';
            } else if (typeof cm === 'object' && cm !== null) {
                // Try direct keys if normalized
                email = cm.email || '';
                phone = cm.phone || '';
            }

            // Extract from Custom Fields
            const cf = p.custom_fields || {};
            const city = cf.city || '';
            // Role often mapped to job_title in UI, checking both
            const role = cf.job_title || cf.role || '';
            const employer = cf.employer || cf.company || '';

            return [
                p.id,
                `"${(p.display_name || '').replace(/"/g, '""')}"`, // Escape quotes
                email,
                phone,
                `"${(city || '').replace(/"/g, '""')}"`,
                p.status || '',
                `"${(role || '').replace(/"/g, '""')}"`,
                `"${(employer || '').replace(/"/g, '""')}"`
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        return actionSuccess({ csv: csvContent });

    } catch (err: any) {
        console.error("Export exception:", err);
        return actionError("Export failed");
    }
}
