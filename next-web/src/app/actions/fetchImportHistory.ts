'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface ImportJob {
    id: string;
    status: string;
    import_type: string;
    file_name: string | null;
    duplicate_policy: string;
    total_rows: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    error_count: number;
    created_at: string;
    completed_at: string | null;
}

export async function fetchImportHistory(): Promise<{ success: boolean; data?: ImportJob[]; error?: string }> {
    try {
        const supabaseAuth = await createClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) return { success: false, error: 'Unauthorized' };

        const supabase = createAdminClient(supabaseUrl, supabaseServiceKey);

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        if (!profile?.tenant_id) return { success: false, error: 'Tenant not found' };

        const { data, error } = await supabase
            .from('import_jobs')
            .select('id, status, import_type, file_name, duplicate_policy, total_rows, created_count, updated_count, skipped_count, error_count, created_at, completed_at')
            .eq('tenant_id', profile.tenant_id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return { success: false, error: error.message };

        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
