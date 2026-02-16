#!/bin/bash
# RLS Policy Checker
# Usage: ./scripts/check-rls-policies.sh <table_name>

set -e

TABLE=$1

if [ -z "$TABLE" ]; then
  echo "Usage: $0 <table_name>"
  exit 1
fi

echo "🔍 Checking RLS for table: $TABLE"
echo ""

# You'll need to set these environment variables or replace with actual connection string
DB_URL=${SUPABASE_DB_URL:-""}

if [ -z "$DB_URL" ]; then
  echo "⚠️  SUPABASE_DB_URL not set. Please set it or edit this script."
  echo ""
  echo "Instead, copy these queries and run them in Supabase SQL Editor:"
  echo ""
  
  echo "-- 1. Check table exists"
  echo "SELECT table_name FROM information_schema.tables"
  echo "WHERE table_schema = 'public' AND table_name = '$TABLE';"
  echo ""
  
  echo "-- 2. Check RLS enabled"
  echo "SELECT tablename, rowsecurity FROM pg_tables"
  echo "WHERE schemaname = 'public' AND tablename = '$TABLE';"
  echo ""
  
  echo "-- 3. Check policies exist"
  echo "SELECT policyname, cmd, qual, with_check FROM pg_policies"
  echo "WHERE tablename = '$TABLE';"
  echo ""
  
  echo "-- 4. Check INSERT policy specifically"
  echo "SELECT policyname, cmd, with_check FROM pg_policies"
  echo "WHERE tablename = '$TABLE' AND cmd = 'INSERT';"
  echo ""
  
  exit 0
fi

# If DB_URL is set, run actual checks
echo "1️⃣ Check table exists..."
psql "$DB_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='$TABLE';" | grep -q "$TABLE" && {
  echo "   ✅ Table exists"
} || {
  echo "   ❌ Table $TABLE does not exist!"
  exit 1
}

echo "2️⃣ Check RLS enabled..."
psql "$DB_URL" -t -c "SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='$TABLE';" | grep -q "t" && {
  echo "   ✅ RLS enabled"
} || {
  echo "   ❌ RLS not enabled on $TABLE!"
  exit 1
}

echo "3️⃣ Check policies exist..."
POLICY_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename='$TABLE';")
if [ "$POLICY_COUNT" -gt 0 ]; then
  echo "   ✅ Found $POLICY_COUNT policies"
else
  echo "   ❌ No policies found on $TABLE!"
  exit 1
fi

echo "4️⃣ Check INSERT policy exists..."
psql "$DB_URL" -t -c "SELECT cmd FROM pg_policies WHERE tablename='$TABLE' AND cmd='INSERT';" | grep -q "INSERT" && {
  echo "   ✅ INSERT policy exists"
} || {
  echo "   ❌ No INSERT policy on $TABLE!"
  exit 1
}

echo "5️⃣ Check INSERT policy uses WITH CHECK..."
psql "$DB_URL" -t -c "SELECT with_check FROM pg_policies WHERE tablename='$TABLE' AND cmd='INSERT';" | grep -q "tenant_id" && {
  echo "   ✅ INSERT policy uses WITH CHECK"
} || {
  echo "   ⚠️  INSERT policy might not use WITH CHECK properly"
}

echo ""
echo "✅ All basic checks passed for $TABLE"
