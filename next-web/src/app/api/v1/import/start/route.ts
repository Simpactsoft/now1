import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { personImportSchema, orgImportSchema, relationshipImportSchema, normalizeEmail, normalizePhone, sanitizeRow, parseTags } from '@/lib/importUtils';
import { ImportStartRequest } from '@/lib/importApi';

export async function POST(req: Request) {
    try {
        const supabase = createAdminClient();

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

        if (!profile?.tenant_id) {
            return NextResponse.json({ error: 'Tenant not found for user' }, { status: 401 });
        }
        const tenantId = profile.tenant_id;

        const body = await req.json() as ImportStartRequest;
        const { rows, mapping, settings } = body;
        const importType = body.import_type || 'people';

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid payload: rows must be an array' }, { status: 400 });
        }

        // Limit for synchronous processing
        if (rows.length > 5000) {
            return NextResponse.json({ error: 'Maximum 5000 rows allowed for synchronous import.' }, { status: 400 });
        }

        // Create import_job record
        const { data: jobData, error: jobError } = await supabase
            .from('import_jobs')
            .insert({
                tenant_id: tenantId,
                user_id: userId,
                status: 'processing',
                import_type: importType,
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

        // ============================
        // PEOPLE IMPORT
        // ============================
        if (importType === 'people') {
            for (let i = 0; i < rows.length; i++) {
                const rawRow = rows[i];
                try {
                    const sanitizedRow = sanitizeRow(rawRow);
                    const email = normalizeEmail(sanitizedRow.email);
                    const phone = normalizePhone(sanitizedRow.phone);
                    const tags = sanitizedRow.tags ? parseTags(sanitizedRow.tags) : undefined;

                    const preparedRow = {
                        ...sanitizedRow,
                        email: email || undefined,
                        phone: phone || undefined,
                        tags,
                    };

                    const validatedData = personImportSchema.safeParse(preparedRow);
                    if (!validatedData.success) {
                        errorCount++;
                        const issues = validatedData.error.issues || [];
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'error', error_details: { type: 'validation_error' },
                            error_message: issues.map((e: any) => e.message).join(', '),
                            raw_data: rawRow
                        });
                        continue;
                    }

                    const data = validatedData.data;
                    const displayName = `${data.first_name} ${data.last_name}`.trim();

                    // Check Duplicates
                    const { data: dupData, error: dupError } = await supabase.rpc('find_duplicates', {
                        p_tenant_id: tenantId, p_entity_type: 'person',
                        p_email: email || null, p_phone: phone || null,
                        p_first_name: data.first_name, p_last_name: data.last_name,
                        p_display_name: null, p_tax_id: null, p_threshold: 0.7
                    });

                    if (dupError) throw new Error('Database error during duplicate check');

                    if (dupData && dupData.length > 0) {
                        const duplicateId = dupData[0].card_id;
                        if (settings.duplicate_policy === 'skip') {
                            skippedCount++;
                            await supabase.from('import_logs').insert({
                                tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                                status: 'skipped', error_details: { type: 'duplicate_skipped' },
                                error_message: `Skipped: matches existing record ${duplicateId}`,
                                raw_data: rawRow
                            });
                            continue;
                        }
                        if (settings.duplicate_policy === 'update') {
                            await supabase.from('cards').update({
                                first_name: data.first_name, last_name: data.last_name,
                                display_name: displayName,
                                email: email || null, phone: phone || null,
                                contact_methods: { email: email || undefined, phone: phone || undefined },
                                status: data.status, tags: data.tags,
                                job_title: rawRow.job_title || null,
                                company_name: rawRow.company_name || null
                            }).eq('id', duplicateId).eq('tenant_id', tenantId);
                            updatedCount++;
                            await supabase.from('import_logs').insert({
                                tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                                status: 'updated', raw_data: rawRow
                            });
                            continue;
                        }
                        if (settings.duplicate_policy === 'manual') {
                            await supabase.from('duplicate_candidates').insert({
                                tenant_id: tenantId, job_id: jobId,
                                card_id: duplicateId, incoming_data: data,
                                match_score: dupData[0].match_score, match_type: dupData[0].match_type,
                                resolution_status: 'pending'
                            });
                            skippedCount++;
                            await supabase.from('import_logs').insert({
                                tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                                status: 'flagged_for_review', error_details: { type: 'duplicate_manual' },
                                error_message: `Flagged for manual review against ${duplicateId}`,
                                raw_data: rawRow
                            });
                            continue;
                        }
                    }

                    // Create new person
                    const { error: insertError } = await supabase.from('cards').insert({
                        tenant_id: tenantId, type: 'person', hierarchy_path: 'org',
                        display_name: displayName,
                        first_name: data.first_name, last_name: data.last_name,
                        email: email || null, phone: phone || null,
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
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'created', raw_data: rawRow
                    });
                } catch (err: any) {
                    errorCount++;
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'error', error_details: { type: 'processing_error' },
                        error_message: err.message || 'Unknown processing error',
                        raw_data: rawRow
                    });
                }
            }
        }

        // ============================
        // ORGANIZATIONS IMPORT
        // ============================
        else if (importType === 'organizations') {
            for (let i = 0; i < rows.length; i++) {
                const rawRow = rows[i];
                try {
                    const sanitizedRow = sanitizeRow(rawRow);
                    const email = normalizeEmail(sanitizedRow.email);
                    const phone = normalizePhone(sanitizedRow.phone);

                    const preparedRow = {
                        ...sanitizedRow,
                        email: email || undefined,
                        phone: phone || undefined,
                    };

                    const validatedData = orgImportSchema.safeParse(preparedRow);
                    if (!validatedData.success) {
                        errorCount++;
                        const issues = validatedData.error.issues || [];
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'error', error_details: { type: 'validation_error' },
                            error_message: issues.map((e: any) => e.message).join(', '),
                            raw_data: rawRow
                        });
                        continue;
                    }

                    const data = validatedData.data;

                    // Check for duplicate by name
                    const { data: dupData } = await supabase.rpc('find_duplicates', {
                        p_tenant_id: tenantId, p_entity_type: 'organization',
                        p_email: email || null, p_phone: phone || null,
                        p_first_name: null, p_last_name: null,
                        p_display_name: data.name, p_tax_id: data.tax_id || null,
                        p_threshold: 0.7
                    });

                    if (dupData && dupData.length > 0) {
                        const duplicateId = dupData[0].card_id;
                        if (settings.duplicate_policy === 'skip') {
                            skippedCount++;
                            await supabase.from('import_logs').insert({
                                tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                                status: 'skipped', error_details: { type: 'duplicate_skipped' },
                                error_message: `Skipped: matches existing org ${duplicateId}`,
                                raw_data: rawRow
                            });
                            continue;
                        }
                        if (settings.duplicate_policy === 'update') {
                            await supabase.from('cards').update({
                                display_name: data.name,
                                email: email || null, phone: phone || null,
                                contact_methods: { email: email || undefined, phone: phone || undefined },
                                industry: data.industry || null,
                                company_size: data.company_size || null,
                                tax_id: data.tax_id || null,
                                website: data.website || null,
                            }).eq('id', duplicateId).eq('tenant_id', tenantId);
                            updatedCount++;
                            await supabase.from('import_logs').insert({
                                tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                                status: 'updated', raw_data: rawRow
                            });
                            continue;
                        }
                    }

                    // Create new organization
                    const { error: insertError } = await supabase.from('cards').insert({
                        tenant_id: tenantId, type: 'organization', hierarchy_path: 'org',
                        display_name: data.name,
                        email: email || null, phone: phone || null,
                        contact_methods: { email: email || undefined, phone: phone || undefined },
                        status: 'active',
                        industry: data.industry || null,
                        company_size: data.company_size || null,
                        tax_id: data.tax_id || null,
                        website: data.website || null,
                        custom_fields: { import_source: 'import', import_job_id: jobId }
                    });
                    if (insertError) throw insertError;
                    createdCount++;
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'created', raw_data: rawRow
                    });
                } catch (err: any) {
                    errorCount++;
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'error', error_details: { type: 'processing_error' },
                        error_message: err.message || 'Unknown processing error',
                        raw_data: rawRow
                    });
                }
            }
        }

        // ============================
        // RELATIONSHIPS IMPORT
        // ============================
        else if (importType === 'relationships') {
            for (let i = 0; i < rows.length; i++) {
                const rawRow = rows[i];
                try {
                    const sanitizedRow = sanitizeRow(rawRow);

                    const validatedData = relationshipImportSchema.safeParse(sanitizedRow);
                    if (!validatedData.success) {
                        errorCount++;
                        const issues = validatedData.error.issues || [];
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'error', error_details: { type: 'validation_error' },
                            error_message: issues.map((e: any) => e.message).join(', '),
                            raw_data: rawRow
                        });
                        continue;
                    }

                    const data = validatedData.data;
                    const personEmail = normalizeEmail(data.person_email);

                    // Find person by email
                    const { data: personCards } = await supabase
                        .from('cards')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('type', 'person')
                        .eq('email', personEmail)
                        .limit(1);

                    if (!personCards || personCards.length === 0) {
                        errorCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'error', error_details: { type: 'lookup_error' },
                            error_message: `Person not found with email: ${personEmail}`,
                            raw_data: rawRow
                        });
                        continue;
                    }
                    const personId = personCards[0].id;

                    // Find organization by name
                    const { data: orgCards } = await supabase
                        .from('cards')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('type', 'organization')
                        .ilike('display_name', data.company_name.trim())
                        .limit(1);

                    if (!orgCards || orgCards.length === 0) {
                        errorCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'error', error_details: { type: 'lookup_error' },
                            error_message: `Organization not found: "${data.company_name}"`,
                            raw_data: rawRow
                        });
                        continue;
                    }
                    const orgId = orgCards[0].id;

                    // Check for existing relationship
                    const { data: existingRel } = await supabase
                        .from('card_relationships')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('source_card_id', personId)
                        .eq('target_card_id', orgId)
                        .eq('relationship_type', data.relationship_type)
                        .limit(1);

                    if (existingRel && existingRel.length > 0) {
                        skippedCount++;
                        await supabase.from('import_logs').insert({
                            tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                            status: 'skipped', error_details: { type: 'duplicate_relationship' },
                            error_message: `Relationship already exists: ${personEmail} → ${data.company_name}`,
                            raw_data: rawRow
                        });
                        continue;
                    }

                    // Create relationship
                    const { error: relError } = await supabase.from('card_relationships').insert({
                        tenant_id: tenantId,
                        source_card_id: personId,
                        target_card_id: orgId,
                        relationship_type: data.relationship_type,
                    });
                    if (relError) throw relError;

                    createdCount++;
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'created', raw_data: rawRow
                    });
                } catch (err: any) {
                    errorCount++;
                    await supabase.from('import_logs').insert({
                        tenant_id: tenantId, job_id: jobId, row_number: i + 1,
                        status: 'error', error_details: { type: 'processing_error' },
                        error_message: err.message || 'Unknown processing error',
                        raw_data: rawRow
                    });
                }
            }
        }

        // Finalize job
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
