-- Migration: Fix get_portal_profile to return status
-- Description: Ensures the Account Status field is extracted and returned properly from custom_fields

CREATE OR REPLACE FUNCTION get_portal_profile(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result jsonb;
    v_party record;
    v_card record;
    v_display_name text;
    v_first_name text;
    v_last_name text;
BEGIN
    -- 1. Check legacy cards table first
    SELECT * INTO v_card
    FROM cards
    WHERE email = user_email
    LIMIT 1;

    IF v_card.id IS NOT NULL THEN
        RETURN to_jsonb(v_card);
    END IF;

    -- 2. Check parties table dynamically to prevent compilation errors if table doesn't exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'parties') THEN
        EXECUTE format($dyn$
            SELECT p.id, p.display_name, p.avatar_url, p.contact_methods, p.custom_fields,
                   pp.first_name, pp.last_name, pp.gender
            FROM parties p
            LEFT JOIN people pp ON pp.party_id = p.id
            WHERE p.contact_methods @> jsonb_build_array(jsonb_build_object('value', %L))
               OR (jsonb_typeof(p.contact_methods) = 'object' AND p.contact_methods->>'email' = %L)
            LIMIT 1
        $dyn$, user_email, user_email) INTO v_party;

        IF v_party.id IS NOT NULL THEN
            -- Map to generic profile shape matching cards for backward compatibility
            v_display_name := v_party.display_name;
            v_first_name := v_party.first_name;
            v_last_name := v_party.last_name;
            
            -- Fallback if display_name is missing
            IF v_display_name IS NULL OR v_display_name = '' THEN
                v_display_name := v_first_name || ' ' || v_last_name;
            END IF;

            RETURN jsonb_build_object(
                'id', v_party.id,
                'email', user_email,
                'first_name', v_first_name,
                'last_name', v_last_name,
                'display_name', v_display_name,
                'avatar_url', v_party.avatar_url,
                'phone', (
                    SELECT value 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(v_party.contact_methods) = 'array' THEN v_party.contact_methods 
                            ELSE '[]'::jsonb 
                        END
                    ) 
                    WHERE obj->>'type' = 'phone' 
                    LIMIT 1
                ),
                'job_title', nullif(v_party.custom_fields->>'job_title', ''),
                'department', nullif(v_party.custom_fields->>'department', ''),
                'status', nullif(v_party.custom_fields->>'status', ''),
                'source', 'parties'
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;
