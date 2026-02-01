
-- Migration: 215_list_status_duplicates.sql
-- Description: Lists PERSON_STATUS values using SELECT to ensure output in Results tab.

SELECT 
    ov.internal_code, 
    ov.label_i18n, 
    ov.tenant_id, 
    ov.is_active,
    os.code as set_code
FROM option_values ov
JOIN option_sets os ON ov.option_set_id = os.id
WHERE os.code = 'PERSON_STATUS'
ORDER BY ov.internal_code;
