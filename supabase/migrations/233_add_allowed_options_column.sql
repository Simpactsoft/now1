-- Migration: 233_add_allowed_options_column.sql
-- Description: Add allowed_options array to support generic 'requires' rules with specific valid options

-- Add the allowed_options column
ALTER TABLE configuration_rules 
ADD COLUMN IF NOT EXISTS allowed_options UUID[] DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN configuration_rules.allowed_options IS 
'For "requires" rules with then_group_id: list of option IDs that are valid selections. If specified, the selected option must be in this list. Example: i9 requires RAM group with allowed_options=[32GB_id, 64GB_id] means only 32GB+ is valid.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_config_rules_allowed_options 
ON configuration_rules USING GIN (allowed_options) 
WHERE allowed_options IS NOT NULL;

-- Update documentation
COMMENT ON TABLE configuration_rules IS 
'Business rules for valid product configurations. Supported rule types:
- requires: if_option selected → then_group/option must be selected (optionally from allowed_options list)
- conflicts: if_option selected → then_option must NOT be selected  
- hides: if_option selected → then_group/option is hidden
- price_tier: quantity-based pricing adjustments';
