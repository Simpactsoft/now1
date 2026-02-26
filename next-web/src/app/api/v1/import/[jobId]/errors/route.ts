// src/app/api/v1/import/[jobId]/errors/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateErrorReportCsv, ImportError } from '@/lib/importUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) {
            console.error('[Import Errors API] Unauthorized user');
            return new NextResponse('Unauthorized user', { status: 401 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch user's tenant since jobs are RLS protected.
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', authData.user.id)
            .single();

        const tenantId = profile?.tenant_id || req.headers.get('x-tenant-id');
        if (!tenantId) {
            return new NextResponse('Tenant not found', { status: 400 });
        }

        const { jobId } = await params;
        console.log(`[Import Errors API] Processing download for job: ${jobId}, tenant: ${tenantId}`);

        // Verify job belongs to tenant
        const { data: job, error: jobError } = await supabase
            .from('import_jobs')
            .select('id')
            .eq('id', jobId)
            .eq('tenant_id', tenantId)
            .single();

        if (jobError || !job) {
            console.error('[Import Errors API] Job not found or access denied:', jobError);
            return new NextResponse('Job not found or access denied', { status: 404 });
        }

        // Fetch error logs
        const { data: errorLogs, error: logError } = await supabase
            .from('import_logs')
            .select('*')
            .eq('job_id', jobId)
            .eq('tenant_id', tenantId)
            .in('status', ['error', 'skipped', 'flagged_for_review'])
            .order('row_number', { ascending: true });

        if (logError) {
            console.error('Fetch Error Logs', logError);
            return new NextResponse('Database error fetching logs', { status: 500 });
        }

        if (!errorLogs || errorLogs.length === 0) {
            return new NextResponse('No errors found for this import job', { status: 404 });
        }

        // Format for CSV generator
        const formattedErrors: ImportError[] = errorLogs.map(log => ({
            row_number: log.row_number,
            status: log.status,
            error_type: log.error_details?.type || 'unknown',
            error_message: log.error_message || '',
            original_data: JSON.stringify(log.raw_data)
        }));

        const csvString = generateErrorReportCsv(formattedErrors);

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="import-errors-${jobId}.csv"`,
            },
        });

    } catch (e: any) {
        console.error('Error endpoint failure', e);
        return new NextResponse(e.message || 'Internal Server Error', { status: 500 });
    }
}
