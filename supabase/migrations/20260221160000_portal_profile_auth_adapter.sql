-- Update Profile RPC Fix FINAL (Simplified JSON Passing)
CREATE OR REPLACE FUNCTION update_portal_profile(
    user_email text,
    arg_first_name text,
    arg_last_name text,
    arg_phone text,
    arg_job_title text DEFAULT NULL,
    arg_department text DEFAULT NULL,
    arg_contact_methods jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_card_id uuid;
    v_party_id uuid;
    v_new_display_name text;
    v_contact_methods jsonb;
BEGIN
    v_new_display_name := trim(arg_first_name || ' ' || arg_last_name);
    
    -- 1. Check if they exist in legacy cards
    SELECT id, contact_methods INTO v_card_id, v_contact_methods FROM cards WHERE email = user_email LIMIT 1;

    IF v_card_id IS NOT NULL THEN
        -- Link new job_title backward compatible to legacy 'role' custom field
        UPDATE cards
        SET 
            first_name = arg_first_name,
            last_name = arg_last_name,
            display_name = v_new_display_name,
            phone = arg_phone, -- Keep legacy column
            contact_methods = coalesce(arg_contact_methods, v_contact_methods), -- Use TS parsed JSON explicitly
            job_title = arg_job_title,
            custom_fields = coalesce(custom_fields, '{}'::jsonb) || jsonb_build_object('job_title', arg_job_title, 'department', arg_department, 'role', arg_job_title),
            updated_at = now()
        WHERE id = v_card_id;

        -- Also update party_memberships if it exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'party_memberships') THEN
            EXECUTE format($dyn$
                UPDATE party_memberships
                SET role_name = %L
                WHERE person_id = %L
            $dyn$, arg_job_title, v_card_id);
        END IF;
        
        RETURN jsonb_build_object('status', 'success', 'source', 'cards');
    END IF;

    -- 2. Check parties dynamically if no legacy card exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'parties') THEN
        EXECUTE format($dyn$
            SELECT id, contact_methods
            FROM parties 
            WHERE contact_methods @> jsonb_build_array(jsonb_build_object('value', %L))
               OR (jsonb_typeof(contact_methods) = 'object' AND contact_methods->>'email' = %L)
            LIMIT 1
        $dyn$, user_email, user_email) INTO v_party_id, v_contact_methods;

        IF v_party_id IS NOT NULL THEN
            
            -- Update Parties backward compatibly syncing to 'role'
            EXECUTE format($dyn$
                UPDATE parties
                SET display_name = %L,
                    updated_at = now(),
                    contact_methods = %L,
                    custom_fields = coalesce(custom_fields, '{}'::jsonb) || jsonb_build_object('job_title', %L, 'department', %L, 'role', %L)
                WHERE id = %L
            $dyn$, v_new_display_name, coalesce(arg_contact_methods, v_contact_methods), arg_job_title, arg_department, arg_job_title, v_party_id);

            -- Update people table
            EXECUTE format($dyn$
                UPDATE people
                SET first_name = %L,
                    last_name = %L
                WHERE party_id = %L
            $dyn$, arg_first_name, arg_last_name, v_party_id);

            -- Update party_memberships table
            EXECUTE format($dyn$
                UPDATE party_memberships
                SET role_name = %L
                WHERE person_id = %L
            $dyn$, arg_job_title, v_party_id);

            RETURN jsonb_build_object('status', 'success', 'source', 'parties');
        END IF;
    END IF;

    RAISE EXCEPTION 'Profile not found';
END;
$$;
