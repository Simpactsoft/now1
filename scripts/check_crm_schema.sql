-- This script checks if the CRM tables exist and their columns.
-- Run this in the Supabase SQL Editor and share the result (CSV or JSON).

SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name IN (
        'cards', 
        'leads', 
        'campaigns', 
        'campaign_members', 
        'pipelines', 
        'pipeline_stages', 
        'opportunities', 
        'opportunity_cards', 
        'opportunity_stage_history', 
        'activities', 
        'activity_links', 
        'activity_inbox'
    )
ORDER BY 
    table_name, ordinal_position;
