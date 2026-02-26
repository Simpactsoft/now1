import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { personImportSchema, normalizeEmail, normalizePhone, sanitizeRow, parseTags } from '@/lib/importUtils';
import { ImportStartRequest } from '@/lib/importApi';

// Explicitly use the Service Role Key since we are executing administrative background work
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch real user id for the import job constraint
        const supabaseAuth = await createServerClient();
        const { data: authData } = await supabaseAuth.auth.getUser();
        if (!authData.user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }
        const userId = authData.user.id;

        // Fetch user's tenant since jobs are RLS protected.
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', userId)
            .single();

        const tenantId = profile?.tenant_id || req.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000001';

        const body = await req.json() as ImportStartRequest;
        const { rows, mapping, settings } = body;

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid payload: rows must be an array' }, { status: 400 });
        }

        // Limit for synchronous processing
        if (rows.length > 5000) {
            return NextResponse.json({ error: 'Maximum 5000 rows allowed for synchronous import in Phase 2.' }, { status: 400 });
        }

        // 4. Create import_job record
        const { data: jobData, error: jobError } = await supabase
            .from('import_jobs')
            .insert({
                tenant_id: tenantId,
                user_id: userId,
                status: 'processing',
                import_type: 'people',
                duplicate_policy: settings.duplicate_policy,
                total_rows: rows.length,
                column_mapping: mapping,
                settings: settings
            })
            .select('id')
            .single();

        if (jobError || !jobData) {
            console.error('Failed to create import job:', jobError);
            return NextResponse.json({ error: 'Failed to initialize import job' }, { status: 500 });
        }

        const jobId = jobData.id;
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // 5. Process rows
        for (let i = 0; i < rows.length; i++) {
            const rawRow = rows[i];
            try {
                // a. Sanitize
                const sanitizedRow = sanitizeRow(rawRow);

                // b. Normalize
                const email = normalizeEmail(sanitizedRow.email);
                const phone = normalizePhone(sanitizedRow.phone);

                // c. Parse tags from CSV string to array (if present)
                const tags = sanitizedRow.tags ? parseTags(sanitizedRow.tags) : undefined;

                const preparedRow = {
                    ...sanitizedRow,
                    email: email || undefined,
                    phone: phone || undefined,
                    tags,
                };

                // d. Validate with Zod
                const validatedData = personImportSchema.safeParse(preparedRow);
                if (!validatedData.success) {
                    errorCount++;
                    // Zod v4 uses .issues instead of .errors
                    const issues = validatedData.error.issues || [];
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId,
                        job_id: jobId,
                        row_number: i + 1,
                        status: 'error',
                        error_details: { type: 'validation_error' },
                        error_message: issues.map((e: any) => e.message).join(', '),
                        raw_data: rawRow
                    });
                    continue;
                }

                const data = validatedData.data;
                const displayName = `${data.first_name} ${data.last_name}`.trim();

                // d. Check Duplicates via RPC
                const { data: dupData, error: dupError } = await supabase.rpc('find_duplicates', {
                    p_tenant_id: tenantId,
                    p_entity_type: 'person',
                    p_email: email || null,
                    p_phone: phone || null,
                    p_first_name: data.first_name,
                    p_last_name: data.last_name,
                    p_display_name: null,
                    p_tax_id: null,
                    p_threshold: 0.7
                });

                if (dupError) {
                    console.error('RPC Error on row', i + 1, dupError);
                    throw new Error('Database error during duplicate check');
                }

                if (dupData && dupData.length > 0) {
                    // Duplicate found
                    const duplicateId = dupData[0].card_id;

                    if (settings.duplicate_policy === 'skip') {
                        skippedCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId,
                            job_id: jobId,
                            row_number: i + 1,
                            status: 'skipped',
                            error_details: { type: 'duplicate_skipped' },
                            error_message: `Skipped: matches existing record ${duplicateId}`,
                            raw_data: rawRow
                        });
                        continue;
                    }

                    if (settings.duplicate_policy === 'update') {
                        // Update existing card
                        const { error: updateError } = await supabase
                            .from('cards')
                            .update({
                                first_name: data.first_name,
                                last_name: data.last_name,
                                display_name: displayName,
                                email: email || null,
                                phone: phone || null,
                                contact_methods: { email: email || undefined, phone: phone || undefined },
                                status: data.status,
                                tags: data.tags,
                                job_title: rawRow.job_title || null,
                                company_name: rawRow.company_name || null // stored loosely per spec
                            })
                            .eq('id', duplicateId)
                            .eq('tenant_id', tenantId);

                        if (updateError) throw updateError;

                        updatedCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId,
                            job_id: jobId,
                            row_number: i + 1,
                            status: 'updated',
                            raw_data: rawRow
                        });
                        continue;
                    }

                    if (settings.duplicate_policy === 'manual') {
                        // Create duplicate candidate for resolution center
                        await supabase.from('duplicate_candidates').insert({
                            tenant_id: tenantId,
                            job_id: jobId,
                            card_id: duplicateId,
                            incoming_data: data,
                            match_score: dupData[0].match_score,
                            match_type: dupData[0].match_type,
                            resolution_status: 'pending'
                        });

                        // We do NOT insert the card itself here, we skip it and wait for human resolution
                        skippedCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId,
                            job_id: jobId,
                            row_number: i + 1,
                            status: 'flagged_for_review',
                            error_details: { type: 'duplicate_manual' },
                            error_message: `Flagged for manual review against ${duplicateId}`,
                            raw_data: rawRow
                        });
                        continue;
                    }
                }

                // f. If no duplicate, or policy allows insert anyway (which shouldn't happen based on above) -> Create new
                const { error: insertError } = await supabase
                    .from('cards')
                    .insert({
                        tenant_id: tenantId,
                        type: 'person',
                        hierarchy_path: 'org',
                        display_name: displayName,
                        first_name: data.first_name,
                        last_name: data.last_name,
                        email: email || null,
                        phone: phone || null,
                        contact_methods: { email: email || undefined, phone: phone || undefined },
                        status: data.status || settings.default_status || 'lead',
                        tags: data.tags,
                        job_title: rawRow.job_title || null,
                        company_name: rawRow.company_name || null,
                        custom_fields: { import_source: 'import', import_job_id: jobId }
                    });

                if (insertError) throw insertError;

                createdCount++;
                await supabase.from('import_logs').insert({
                    tenant_id: tenantId,
                    job_id: jobId,
                    row_number: i + 1,
                    status: 'created',
                    raw_data: rawRow
                });

            } catch (err: any) {
                errorCount++;
                await supabase.from('import_logs').insert({
                    tenant_id: tenantId,
                    job_id: jobId,
                    row_number: i + 1,
                    status: 'error',
                    error_details: { type: 'processing_error' },
                    error_message: err.message || 'Unknown processing error',
                    raw_data: rawRow
                });
            }
        }

        // 6. Finalize job
        await supabase
            .from('import_jobs')
            .update({
                status: 'completed',
                processed_rows: rows.length,
                created_count: createdCount,
                updated_count: updatedCount,
                skipped_count: skippedCount,
                error_count: errorCount,
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .eq('tenant_id', tenantId);

        return NextResponse.json({
            job_id: jobId,
            status: 'completed',
            results: { created: createdCount, updated: updatedCount, skipped: skippedCount, errors: errorCount }
        });

    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
