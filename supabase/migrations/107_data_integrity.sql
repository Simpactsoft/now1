
-- Migration: 107_data_integrity.sql
-- Description: Adds validation rules to Attribute Definitions and enforces them via Trigger on Cards.
-- Phase 6 of ERP Foundation.

BEGIN;

-- 1. Schema Extensions for Attribute Definitions
-- Allows Admin to define rules like Regex, Masks, etc.
ALTER TABLE attribute_definitions
    ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS input_mask TEXT, -- e.g. '(999) 999-9999'
    ADD COLUMN IF NOT EXISTS placeholder TEXT; -- e.g. 'Enter license plate'

-- 2. Validation Logic (The "Bouncer")
CREATE OR REPLACE FUNCTION validate_card_attributes()
RETURNS TRIGGER AS $$
DECLARE
    attr RECORD;
    val JSONB;
    val_text TEXT;
    rules JSONB;
BEGIN
    -- Optimization: Only check if custom_fields changed (or new insert)
    IF (TG_OP = 'UPDATE' AND NEW.custom_fields IS NOT DISTINCT FROM OLD.custom_fields) THEN
        RETURN NEW;
    END IF;

    -- Iterate over all Attribute Definitions for this Tenant & Entity Type
    -- We need to check both "Required" fields (existence) and "Validation Rules" (content).
    FOR attr IN 
        SELECT attribute_key, is_required, validation_rules, label_i18n
        FROM attribute_definitions
        WHERE tenant_id = NEW.tenant_id
        AND (entity_type = NEW.type::text OR entity_type = 'party') -- Match Person/Org or Both
    LOOP
        -- Get value from Custom Fields
        val := NEW.custom_fields -> attr.attribute_key;
        
        -- A. Check Required
        IF attr.is_required THEN
            -- If value is null, undefined, or empty string (for text)
            IF val IS NULL OR val = 'null'::jsonb OR (jsonb_typeof(val) = 'string' AND length(trim(val::text, '"')) = 0) THEN
                RAISE EXCEPTION 'Validation Failed: Field "%" is required.', attr.label_i18n->>'en' -- Fallback to EN label or key
                USING ERRCODE = 'P0002'; -- Custom Logic Error
            END IF;
        END IF;

        -- B. Check Validation Rules (Regex, Min, Max)
        IF val IS NOT NULL AND val != 'null'::jsonb AND attr.validation_rules IS NOT NULL THEN
            val_text := trim(val::text, '"'); -- Unquote string
            rules := attr.validation_rules;

            -- 1. Regex Pattern
            IF rules ? 'regex' AND rules->>'regex' IS NOT NULL THEN
                IF val_text !~ (rules->>'regex') THEN
                    RAISE EXCEPTION 'Validation Failed: Field "%" format is invalid (Pattern mismatch).', attr.label_i18n->>'en'
                    USING ERRCODE = 'P0002';
                END IF;
            END IF;

            -- 2. Min Length (Strings)
            IF rules ? 'min_length' THEN
                IF length(val_text) < (rules->>'min_length')::int THEN
                    RAISE EXCEPTION 'Validation Failed: Field "%" is too short (Min: %).', attr.label_i18n->>'en', rules->>'min_length'
                    USING ERRCODE = 'P0002';
                END IF;
            END IF;
            
             -- 3. Max Length (Strings)
            IF rules ? 'max_length' THEN
                IF length(val_text) > (rules->>'max_length')::int THEN
                    RAISE EXCEPTION 'Validation Failed: Field "%" is too long (Max: %).', attr.label_i18n->>'en', rules->>'max_length'
                    USING ERRCODE = 'P0002';
                END IF;
            END IF;

            -- 4. Numeric Checks (Min/Max Value)
            IF jsonb_typeof(val) = 'number' THEN
                 IF rules ? 'min_value' THEN
                    IF (val::text)::numeric < (rules->>'min_value')::numeric THEN
                         RAISE EXCEPTION 'Validation Failed: Field "%" must be at least %.', attr.label_i18n->>'en', rules->>'min_value'
                         USING ERRCODE = 'P0002';
                    END IF;
                 END IF;
                 IF rules ? 'max_value' THEN
                    IF (val::text)::numeric > (rules->>'max_value')::numeric THEN
                         RAISE EXCEPTION 'Validation Failed: Field "%" must be at most %.', attr.label_i18n->>'en', rules->>'max_value'
                         USING ERRCODE = 'P0002';
                    END IF;
                 END IF;
            END IF;

        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Bind Trigger (Before Insert/Update)
DROP TRIGGER IF EXISTS trg_validate_attributes ON cards;
CREATE TRIGGER trg_validate_attributes
    BEFORE INSERT OR UPDATE
    ON cards
    FOR EACH ROW
    EXECUTE FUNCTION validate_card_attributes();

COMMIT;
