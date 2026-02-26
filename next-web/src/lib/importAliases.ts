// src/lib/importAliases.ts

export const FIELD_ALIASES: Record<string, string[]> = {
    first_name: [
        'first name', 'first_name', 'firstname', 'fname',
        'given name', 'given_name',
        'שם פרטי', 'שם_פרטי',
    ],
    last_name: [
        'last name', 'last_name', 'lastname', 'lname',
        'family name', 'family_name', 'surname',
        'שם משפחה', 'שם_משפחה', 'משפחה',
    ],
    email: [
        'email', 'e-mail', 'email address', 'email_address',
        'דוא"ל', 'דואל', 'אימייל', 'מייל', 'כתובת מייל',
    ],
    phone: [
        'phone', 'phone number', 'phone_number', 'tel', 'telephone',
        'mobile', 'mobile phone', 'cell', 'cellphone',
        'טלפון', 'נייד', 'טל', 'מספר טלפון', 'פלאפון', 'סלולרי',
    ],
    status: [
        'status', 'stage', 'lifecycle', 'lifecycle stage',
        'סטטוס', 'שלב', 'מצב',
    ],
    tags: [
        'tags', 'labels', 'categories',
        'תגיות', 'תוויות', 'קטגוריות',
    ],
    job_title: [
        'job title', 'job_title', 'title', 'position', 'role',
        'תפקיד', 'תואר תפקיד',
    ],
    company_name: [
        'company', 'company name', 'company_name', 'organization',
        'org', 'org name', 'employer',
        'חברה', 'שם חברה', 'ארגון', 'שם ארגון', 'מקום עבודה',
    ],
    notes: [
        'notes', 'note', 'comments', 'comment', 'description', 'memo',
        'הערות', 'הערה', 'תיאור',
    ],
};

// Auto-mapping function:
export function autoMapColumns(
    fileHeaders: string[],
    fieldAliases: Record<string, string[]>
): Record<string, string | null> {
    const mapping: Record<string, string | null> = {};
    const usedFields = new Set<string>();

    for (const header of fileHeaders) {
        const normalized = header.toLowerCase().trim();
        let matched = false;

        for (const [field, aliases] of Object.entries(fieldAliases)) {
            if (usedFields.has(field)) continue;
            if (aliases.includes(normalized)) {
                mapping[header] = field;
                usedFields.add(field);
                matched = true;
                break;
            }
        }

        if (!matched) {
            mapping[header] = null; // "Don't import"
        }
    }

    return mapping;
}

export const PERSON_IMPORT_FIELDS = [
    { value: 'first_name', label: 'שם פרטי', required: true },
    { value: 'last_name', label: 'שם משפחה', required: true },
    { value: 'email', label: 'אימייל', required: false },
    { value: 'phone', label: 'טלפון', required: false },
    { value: 'status', label: 'סטטוס', required: false },
    { value: 'tags', label: 'תגיות', required: false },
    { value: 'job_title', label: 'תפקיד', required: false },
    { value: 'company_name', label: 'שם חברה', required: false },
    { value: 'notes', label: 'הערות', required: false },
    { value: null, label: 'לא לייבא', required: false },
] as const;

export const ORG_FIELD_ALIASES: Record<string, string[]> = {
    name: [
        'name', 'company name', 'company_name', 'organization', 'org name',
        'שם', 'שם חברה', 'שם ארגון', 'ארגון',
    ],
    email: [
        'email', 'e-mail', 'company email', 'org email',
        'דוא"ל', 'אימייל', 'מייל',
    ],
    phone: [
        'phone', 'phone number', 'tel', 'telephone', 'office phone',
        'טלפון', 'טלפון חברה', 'טלפון משרד',
    ],
    industry: [
        'industry', 'sector', 'field',
        'תעשייה', 'ענף', 'תחום',
    ],
    company_size: [
        'company size', 'company_size', 'size', 'employees', 'num employees',
        'גודל חברה', 'גודל', 'מספר עובדים',
    ],
    tax_id: [
        'tax id', 'tax_id', 'vat', 'registration', 'company id', 'ח.פ.',
        'מספר עוסק', 'ח.פ', 'עוסק מורשה',
    ],
    website: [
        'website', 'url', 'web', 'homepage',
        'אתר', 'אתר אינטרנט', 'כתובת אתר',
    ],
};

export const ORG_IMPORT_FIELDS = [
    { value: 'name', label: 'שם ארגון', required: true },
    { value: 'email', label: 'אימייל', required: false },
    { value: 'phone', label: 'טלפון', required: false },
    { value: 'industry', label: 'תעשייה', required: false },
    { value: 'company_size', label: 'גודל חברה', required: false },
    { value: 'tax_id', label: 'ח.פ. / מספר עוסק', required: false },
    { value: 'website', label: 'אתר אינטרנט', required: false },
    { value: null, label: 'לא לייבא', required: false },
] as const;

export const RELATIONSHIP_FIELD_ALIASES: Record<string, string[]> = {
    person_email: [
        'person email', 'person_email', 'email', 'contact email',
        'אימייל איש קשר', 'מייל איש קשר',
    ],
    company_name: [
        'company name', 'company_name', 'organization', 'org name', 'company',
        'שם חברה', 'ארגון', 'שם ארגון',
    ],
    relationship_type: [
        'relationship type', 'relationship_type', 'type', 'relation', 'role',
        'סוג קשר', 'סוג', 'יחס',
    ],
};

export const RELATIONSHIP_IMPORT_FIELDS = [
    { value: 'person_email', label: 'אימייל איש קשר', required: true },
    { value: 'company_name', label: 'שם ארגון', required: true },
    { value: 'relationship_type', label: 'סוג קשר', required: true },
    { value: null, label: 'לא לייבא', required: false },
] as const;

// Helper to get correct config per import type
export type ImportType = 'people' | 'organizations' | 'relationships';

export function getFieldsForType(type: ImportType) {
    switch (type) {
        case 'organizations':
            return { fields: ORG_IMPORT_FIELDS, aliases: ORG_FIELD_ALIASES };
        case 'relationships':
            return { fields: RELATIONSHIP_IMPORT_FIELDS, aliases: RELATIONSHIP_FIELD_ALIASES };
        default:
            return { fields: PERSON_IMPORT_FIELDS, aliases: FIELD_ALIASES };
    }
}
