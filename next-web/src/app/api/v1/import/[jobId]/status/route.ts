// src/app/api/v1/import/[jobId]/status/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        const supabase = createAdminClient();

        // Fetch user's tenant since jobs are RLS protected.
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        const tenantId = profile?.tenant_id || req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
        }

        const { jobId } = await params;

        const { data: job, error } = await supabase
            .from('import_jobs')
            .select('*')
            .eq('id', jobId)
            .eq('tenant_id', tenantId)
            .single();

        if (error || !job) {
            console.error('Fetch Job Error', error);
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const progress = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;

        return NextResponse.json({
            job_id: job.id,
            status: job.status,
            progress: progress,
            total_rows: job.total_rows,
            processed_rows: job.processed_rows,
            created_count: job.created_count,
            updated_count: job.updated_count,
            skipped_count: job.skipped_count,
            error_count: job.error_count
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
