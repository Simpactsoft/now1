#!/bin/bash
# Migration Validator
# Usage: ts - node scripts / validate - migration.ts < migration - file.sql >

import { readFileSync } from 'fs'
import { join } from 'path'

interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
    info: string[]
}

function validateMigration(filePath: string): ValidationResult {
    const content = readFileSync(filePath, 'utf-8')
    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        info: []
    }

    // Check 1: If creating table, must enable RLS
    const hasCreateTable = /CREATE TABLE/gi.test(content)
    const hasEnableRLS = /ENABLE ROW LEVEL SECURITY/gi.test(content)

    if (hasCreateTable && !hasEnableRLS) {
        result.errors.push(
            '❌ Migration creates table(s) but does not enable RLS'
        )
        result.valid = false
    }

    // Check 2: If table has tenant_id, must have policies
    const hasTenantId = /tenant_id/gi.test(content)
    const hasPolicies = /CREATE POLICY/gi.test(content)

    if (hasCreateTable && hasTenantId && !hasPolicies) {
        result.errors.push(
            '❌ Multi-tenant table created without RLS policies'
        )
        result.valid = false
    }

    // Check 3: INSERT policies should have WITH CHECK
    const insertPolicyRegex = /CREATE POLICY.*FOR INSERT/gis
    const insertPolicies = content.match(insertPolicyRegex) || []

    for (const policy of insertPolicies) {
        if (!policy.includes('WITH CHECK')) {
            result.errors.push(
                '❌ INSERT policy found without WITH CHECK clause'
            )
            result.valid = false
        }
    }

    // Check 4: Policies should use auth.uid() not current_user
    if (content.includes('current_user') || content.includes('session_user')) {
        result.warnings.push(
            '⚠️  Policy uses current_user or session_user - consider using auth.uid() instead'
        )
    }

    // Check 5: Multi-tenant tables should have index on tenant_id
    if (hasTenantId) {
        const hasIndex = /CREATE INDEX.*tenant_id/gi.test(content)
        if (!hasIndex) {
            result.warnings.push(
                '⚠️  Multi-tenant table without index on tenant_id - may cause performance issues'
            )
        }
    }

    // Check 6: Dropped tables - warning about data loss
    const hasDropTable = /DROP TABLE/gi.test(content)
    if (hasDropTable) {
        result.warnings.push(
            '⚠️  Migration drops table(s) - ensure you have backups!'
        )
    }

    // Info: Summary
    if (hasCreateTable) {
        const tableMatches = content.match(/CREATE TABLE\s+(\w+)/gi) || []
        result.info.push(
            `ℹ️  Creates ${tableMatches.length} table(s): ${tableMatches.map(m =>
                m.replace(/CREATE TABLE\s+/i, '')
            ).join(', ')}`
        )
    }

    if (hasPolicies) {
        const policyMatches = content.match(/CREATE POLICY\s+"([^"]+)"/gi) || []
        result.info.push(
            `ℹ️  Creates ${policyMatches.length} policies`
        )
    }

    return result
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.error('Usage: ts-node validate-migration.ts <migration-file.sql>')
        process.exit(1)
    }

    const filePath = join(process.cwd(), args[0])
    const result = validateMigration(filePath)

    console.log('\n🔍 Migration Validation Report')
    console.log('==============================\n')

    if (result.errors.length > 0) {
        console.log('ERRORS:')
        result.errors.forEach(err => console.log(err))
        console.log()
    }

    if (result.warnings.length > 0) {
        console.log('WARNINGS:')
        result.warnings.forEach(warn => console.log(warn))
        console.log()
    }

    if (result.info.length > 0) {
        console.log('INFO:')
        result.info.forEach(info => console.log(info))
        console.log()
    }

    if (result.valid) {
        console.log('✅ Validation passed!\n')
        process.exit(0)
    } else {
        console.log('❌ Validation failed - please fix errors above\n')
        process.exit(1)
    }
}

export { validateMigration }
