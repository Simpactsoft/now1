'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

export interface ImportedCard {
    id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    type: string;
    created_at: string;
}

export async function fetchImportedCards(jobId: string): Promise<ActionResult<ImportedCard[]>> {
    if (!jobId) return actionError('Job ID is required', 'VALIDATION_ERROR');

    try {
        const supabaseAuth = await createClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) return actionError('Unauthorized', 'AUTH_ERROR');

        const supabase = createAdminClient();

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        if (!profile?.tenant_id) return actionError('Tenant not found', 'AUTH_ERROR');

        // Query cards that were created by this import job
        const { data, error } = await supabase
            .from('cards')
            .select('id, display_name, email, phone, status, type, created_at')
            .eq('tenant_id', profile.tenant_id)
            .eq('custom_fields->>import_job_id', jobId)
            .order('created_at', { ascending: true })
            .limit(500);

        if (error) return actionError(error.message, 'DB_ERROR');

        return actionSuccess(data || []);
    } catch (e: any) {
        return actionError(e.message, 'INTERNAL_ERROR');
    }
}
