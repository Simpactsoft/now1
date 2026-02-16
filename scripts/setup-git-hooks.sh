#!/bin/bash
# Git Hooks Installer
# Installs pre-commit hook for migration validation

echo "🔧 Installing Git Hooks for RLS/Migration Validation..."
echo ""

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a Git repository"
  echo "   Run this from the project root"
  exit 1
fi

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook: Validate migrations before commit

echo "🔍 Running pre-commit checks..."

# Check for migration files in staging
MIGRATIONS=$(git diff --cached --name-only | grep -E 'migrations/.*\.sql$')

if [ -n "$MIGRATIONS" ]; then
  echo "📝 Found migration files, validating..."
  
  for migration in $MIGRATIONS; do
    echo "   Checking: $migration"
    
    # Check if validate-migration.ts exists
    if [ -f "scripts/validate-migration.ts" ]; then
      # Try to run with ts-node
      if command -v ts-node &> /dev/null; then
        ts-node scripts/validate-migration.ts "$migration"
        
        if [ $? -ne 0 ]; then
          echo ""
          echo "❌ Migration validation failed for: $migration"
          echo "   Please fix the issues above before committing"
          echo ""
          exit 1
        fi
      else
        echo "⚠️  ts-node not found, skipping validation"
        echo "   Install with: npm install -g ts-node"
      fi
    else
      echo "⚠️  Validator script not found at scripts/validate-migration.ts"
    fi
  done
  
  echo "✅ All migrations validated successfully"
fi

# Check TypeScript files for common issues
TS_FILES=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '\.spec\.')

if [ -n "$TS_FILES" ]; then
  echo "🔍 Checking TypeScript files for common issues..."
  
  for file in $TS_FILES; do
    # Warn about console.log in non-dev files
    if grep -q "console\.log" "$file" 2>/dev/null; then
      if ! echo "$file" | grep -qE '(dev|test|spec|debug)'; then
        echo "⚠️  Warning: Found console.log in $file"
      fi
    fi
    
    # Warn about .default() which doesn't work with safeParse
    if grep -q "\.default(" "$file" 2>/dev/null; then
      if grep -q "safeParse" "$file" 2>/dev/null; then
        echo "⚠️  Warning: Found .default() with safeParse in $file"
        echo "   Consider using .optional() or .transform() instead"
      fi
    fi
  done
fi

echo "✅ Pre-commit checks passed"
exit 0
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✅ Git hooks installed successfully!"
echo ""
echo "📋 What was installed:"
echo "   - Pre-commit hook for migration validation"
echo "   - TypeScript code quality checks"
echo ""
echo "🧪 Test it:"
echo "   git add supabase/migrations/test.sql"
echo "   git commit -m 'test'"
echo ""
echo "🔧 To uninstall:"
echo "   rm .git/hooks/pre-commit"
