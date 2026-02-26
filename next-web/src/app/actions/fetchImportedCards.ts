'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface ImportedCard {
    id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    type: string;
    created_at: string;
}

export async function fetchImportedCards(jobId: string): Promise<{ success: boolean; data?: ImportedCard[]; error?: string }> {
    if (!jobId) return { success: false, error: 'Job ID is required' };

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

        // Query cards that were created by this import job
        const { data, error } = await supabase
            .from('cards')
            .select('id, display_name, email, phone, status, type, created_at')
            .eq('tenant_id', profile.tenant_id)
            .eq('custom_fields->>import_job_id', jobId)
            .order('created_at', { ascending: true })
            .limit(500);

        if (error) return { success: false, error: error.message };

        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
