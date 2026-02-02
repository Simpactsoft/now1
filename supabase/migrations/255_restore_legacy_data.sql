-- Migration: 255_restore_legacy_data.sql
-- Description: Batch migration to restore legacy 'employees' data to 'cards'.
-- Source Tenants: ...0003 (1.25M) and ...442 (1M).
-- Target Tenant: 4d145b9e-4a75-5567-a0af-bcc4a30891e5 (Active).

CREATE OR REPLACE FUNCTION restore_legacy_employees()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_tenants uuid[] := ARRAY[
        '00000000-0000-0000-0000-000000000003'::uuid, 
        '4b1f650a-8e36-5a08-b37d-0829286b2442'::uuid
    ];
    v_target_tenant uuid := '4d145b9e-4a75-5567-a0af-bcc4a30891e5'::uuid;
    v_batch_size int := 10000;
    v_total_inserted int := 0;
    v_inserted int;
BEGIN
    -- Loop until no more records to insert
    LOOP
        WITH batch AS (
            SELECT 
                e.id,
                e.name,
                e.created_at,
                e.salary,
                e.manager_id
            FROM employees e
            WHERE e.tenant_id = ANY(v_source_tenants)
            AND NOT EXISTS (
                SELECT 1 FROM cards c WHERE c.id = e.id
            )
            LIMIT v_batch_size
        )
        INSERT INTO cards (
            id, 
            tenant_id, 
            type, 
            display_name, 
            status, 
            created_at, 
            custom_fields
        )
        SELECT 
            b.id,
            v_target_tenant,
            'person',
            b.name,
            'imported',
            b.created_at,
            jsonb_build_object(
                'salary', b.salary,
                'manager_id', b.manager_id,
                'migration_source', 'legacy_employees'
            )
        FROM batch b
        ON CONFLICT (id) DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_total_inserted := v_total_inserted + v_inserted;

        -- Raise notice for progress tracking (visible in server logs/console)
        RAISE NOTICE 'Inserted batch of % rows. Total so far: %', v_inserted, v_total_inserted;

        -- Exit if no rows were inserted in this batch (done)
        EXIT WHEN v_inserted = 0;
    END LOOP;

    RETURN 'Migration Completed. Total Records Restored: ' || v_total_inserted;
END;
$$;

-- Execute the migration immediately
SELECT restore_legacy_employees();
