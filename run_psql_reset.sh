#!/bin/bash

# Extract DATABASE_URL from .env.local
DB_URL=$(grep DATABASE_URL next-web/.env.local | cut -d '=' -f2 | tr -d '"')

# Replace the IPv6 direct host with the IPv4 Pooler for local psql compatibility
POOLER_URL="${DB_URL/db.fmhnwxtapdqzqrsjdxsm.supabase.co:5432/aws-0-eu-central-1.pooler.supabase.com:6543}"

echo "🚀 Starting database Reset & V2 Seed Process via psql..."

# Prepare the Drop commands
cat << 'EOF' > drop_legacy_tables.sql
DROP TABLE IF EXISTS "activities" CASCADE;
DROP TABLE IF EXISTS "activity_links" CASCADE;
DROP TABLE IF EXISTS "activity_participants" CASCADE;
DROP TABLE IF EXISTS "activity_participants_v2" CASCADE;
DROP TABLE IF EXISTS "activity_status_history" CASCADE;
DROP TABLE IF EXISTS "activity_status_definitions" CASCADE;
DROP TABLE IF EXISTS "commission_ledger" CASCADE;
DROP TABLE IF EXISTS "commission_rules" CASCADE;
DROP TABLE IF EXISTS "commission_plans" CASCADE;
EOF

echo "🧹 Dropping legacy tables..."
psql "$POOLER_URL" -f drop_legacy_tables.sql

MIGRATIONS=(
    "20260228000000_hybrid_crm_core.sql"
    "20260228000001_hybrid_crm_seed.sql"
    "20260228000003_crm_activity_engine_v2.sql"
    "20260228000004_unified_cards.sql"
    "20260228000005_add_completed_at.sql"
    "20260228000010_unified_activity_stream.sql"
    "20260228000011_activity_stream_triggers.sql"
    "20260228000012_fix_rls_activity_stream.sql"
    "20260228000015_safe_activity_schema_upgrade.sql"
    "44_seed_orbit_master_50k.sql"
)

for file in "${MIGRATIONS[@]}"; do
    FILE_PATH="supabase/migrations/$file"
    if [ -f "$FILE_PATH" ]; then
        echo "⏳ Applying $file..."
        psql "$POOLER_URL" -f "$FILE_PATH"
        if [ $? -eq 0 ]; then
            echo "✅ Success: $file"
        else
            echo "❌ Failed to apply $file!"
            exit 1
        fi
    else
        echo "⚠️  File not found: $file"
    fi
done

echo "🎉 Master V2 Core DB Reset & Seeding Completed successfully!"
rm drop_legacy_tables.sql
