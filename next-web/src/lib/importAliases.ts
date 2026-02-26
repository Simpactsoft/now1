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
