import { z } from 'zod';

// --- Validation Schemas --- //

export const personImportSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(100).trim(),
    last_name: z.string().min(1, 'Last name is required').max(100).trim(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().max(20).optional().or(z.literal('')),
    status: z.enum(['lead', 'customer', 'prospect', 'inactive']).default('lead'),
    tags: z.array(z.string().max(50)).max(20).default([]),
    custom_fields: z.record(z.unknown()).default({}),
});

export const orgImportSchema = z.object({
    name: z.string().min(1, 'Organization name is required').max(200).trim(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().max(20).optional().or(z.literal('')),
    industry: z.string().optional().or(z.literal('')),
    company_size: z.string().optional().or(z.literal('')),
    tax_id: z.string().max(50).optional().or(z.literal('')),
    website: z.string().url('Invalid URL format').optional().or(z.literal('')),
});

// --- Normalization & Sanitization --- //

/**
 * Normalizes an email address (lowercase, trim)
 */
export function normalizeEmail(email: string | null | undefined): string {
    if (!email) return '';
    return email.toLowerCase().trim();
}

/**
 * Normalizes a phone number (removes non-digits except +)
 */
export function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '').trim();
}

/**
 * Prevents CSV Injection by prefixing dangerous characters
 */
export function sanitizeCsvField(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const strValue = String(value);
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerousChars.some(c => strValue.startsWith(c))) {
        return "'" + strValue; // Prefix with single quote to tell Excel it's text
    }
    return strValue;
}

/**
 * Sanitizes an entire row for import/export
 */
export function sanitizeRow(row: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
        sanitized[key] = sanitizeCsvField(value);
    }
    return sanitized;
}

/**
 * Parses a string of tags into an array, supporting common delimiters
 */
export function parseTags(input: string | string[] | null | undefined): string[] {
    if (Array.isArray(input)) return input.map(t => typeof t === 'string' ? t.trim() : String(t).trim()).filter(Boolean);
    if (!input) return [];

    const strInput = String(input);
    const delimiters = [';', ',', '|'];
    for (const d of delimiters) {
        if (strInput.includes(d)) {
            return strInput.split(d).map(t => t.trim()).filter(Boolean);
        }
    }

    return [strInput.trim()].filter(Boolean);
}

/**
 * Detects if a value has been corrupted into scientific notation by Excel
 */
export function detectScientificNotation(value: string | number | null | undefined): { isScientific: boolean; warning?: string } {
    if (value === null || value === undefined || value === '') return { isScientific: false };
    const strValue = String(value);
    const sciPattern = /^-?\d+\.?\d*[eE][+\-]?\d+$/;
    if (sciPattern.test(strValue)) {
        return {
            isScientific: true,
            warning: `Value "${strValue}" appears to be in scientific notation. This may indicate data corruption by Excel. Consider re-exporting from the original source as XLSX.`
        };
    }
    return { isScientific: false };
}

// --- Import/Export Helpers --- //

export interface ImportError {
    row_number: number;
    status: string;
    error_type: string;
    error_message: string;
    original_data: string;
}

/**
 * Generates a CSV string with a UTF-8 BOM, suitable for opening in Excel with Hebrew support.
 */
export function generateErrorReportCsv(rows: ImportError[]): string {
    const BOM = '\uFEFF'; // UTF-8 BOM
    const headers = ['row_number', 'status', 'error_type', 'error_message', 'original_data'];

    const csvRows = rows.map(r =>
        headers.map(h => {
            const val = String(r[h as keyof ImportError] || '');
            const sanitized = sanitizeCsvField(val);
            // Wrap in quotes if contains comma, newline, or quotes
            if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
                return '"' + sanitized.replace(/"/g, '""') + '"';
            }
            return sanitized;
        }).join(',')
    );

    return BOM + headers.join(',') + '\n' + csvRows.join('\n');
}
