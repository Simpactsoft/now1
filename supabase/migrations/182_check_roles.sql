
-- Check valid enum values for app_role
SELECT unnest(enum_range(NULL::app_role));
