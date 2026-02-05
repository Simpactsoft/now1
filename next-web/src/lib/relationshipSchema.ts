
export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'rating' | 'picklist' | 'currency';

export interface FieldDefinition {
    key: string;
    label: string;
    type: FieldType;
    options?: string[]; // For picklist
    placeholder?: string;
    required?: boolean;
}

export interface RelationshipTypeDefinition {
    id: string; // internal key
    label: string;
    fields: FieldDefinition[];
}

export const RELATIONSHIP_SCHEMA: Record<string, RelationshipTypeDefinition> = {
    'Professional': {
        id: 'professional',
        label: 'Professional / Career',
        fields: [
            { key: 'origin', label: 'Origin', type: 'picklist', options: ['Recruitment', 'Referral', 'Headhunter', 'Upwork', 'Fiverr', 'Agency'], placeholder: 'Select origin' },
            { key: 'status', label: 'Status', type: 'picklist', options: ['Active', 'On Bench', 'Past', 'On Leave'], placeholder: 'Select status' },
            { key: 'reliability', label: 'Reliability (1-5)', type: 'rating', placeholder: 'Rate reliability' },
            { key: 'scope', label: 'Scope of Work', type: 'text', placeholder: 'e.g., Full-stack development' },
            { key: 'sowLink', label: 'SOW / Contract Link', type: 'text', placeholder: 'https://...' },
            { key: 'startDate', label: 'Start Date', type: 'date' },
            { key: 'endDate', label: 'End Date', type: 'date' }
        ]
    },
    'Investor': {
        id: 'investor',
        label: 'Investor Relations',
        fields: [
            { key: 'ownershipPercentage', label: 'Ownership %', type: 'number', placeholder: 'e.g. 5.5' },
            { key: 'dueDiligenceStatus', label: 'Due Diligence', type: 'picklist', options: ['Not Started', 'In Progress', 'Approved', 'Rejected'], placeholder: 'Select status' },
            { key: 'aum', label: 'Assets Under Management (AUM)', type: 'currency', placeholder: 'e.g. 50M' },
            { key: 'investmentRound', label: 'Investment Round', type: 'picklist', options: ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Late Stage'] },
            { key: 'commitmentDate', label: 'Commitment Date', type: 'date' }
        ]
    },
    'Governance': {
        id: 'governance',
        label: 'Governance & Board',
        fields: [
            { key: 'termNumber', label: 'Term Number', type: 'number', placeholder: 'e.g. 1' },
            { key: 'votingRights', label: 'Voting Rights', type: 'boolean' },
            { key: 'termExpiry', label: 'Term Expiry', type: 'date' },
            { key: 'committee', label: 'Committee', type: 'picklist', options: ['Audit', 'Compensation', 'Strategy', 'None'] }
        ]
    },
    'Intelligence': {
        id: 'intelligence',
        label: 'Intelligence & Ethics',
        fields: [
            { key: 'connectionStrength', label: 'Connection Strength (1-10)', type: 'rating' },
            { key: 'brandEthics', label: 'Brand Ethics Perception (1-10)', type: 'rating' },
            { key: 'warmIntroPath', label: 'Warm Intro Path', type: 'text', placeholder: 'e.g. via John Doe' },
            { key: 'lastContext', label: 'Last Interaction Context', type: 'text' }
        ]
    },
    'Default': {
        id: 'default',
        label: 'Standard Relationship',
        fields: [
            { key: 'jobTitle', label: 'Job Title / Role', type: 'text', placeholder: 'e.g. CEO' },
            { key: 'startDate', label: 'Start Date', type: 'date' }
        ]
    }
};

export const getDefinitionForType = (typeName: string): RelationshipTypeDefinition => {
    // Simple heuristic mapping
    const lower = typeName.toLowerCase();
    if (lower.includes('investor') || lower.includes('fund') || lower.includes('lp') || lower.includes('portfolio')) return RELATIONSHIP_SCHEMA['Investor'];
    if (lower.includes('board') || lower.includes('director') || lower.includes('advisor')) return RELATIONSHIP_SCHEMA['Governance'];
    if (lower.includes('consultant') || lower.includes('contractor') || lower.includes('employee') || lower.includes('staff') || lower.includes('employer') || lower.includes('client') || lower.includes('provider') || lower.includes('vendor')) return RELATIONSHIP_SCHEMA['Professional'];
    if (lower.includes('intel') || lower.includes('scout')) return RELATIONSHIP_SCHEMA['Intelligence'];

    return RELATIONSHIP_SCHEMA['Default'];
};

export const RELATIONSHIP_PAIRS: {
    forward: string,
    reverse: string,
    type: string,
    sourceTypes: ('person' | 'organization')[],
    targetTypes: ('person' | 'organization')[]
}[] = [
        // Professional (Org -> Person)
        { forward: 'Employer', reverse: 'Employee', type: 'Professional', sourceTypes: ['organization'], targetTypes: ['person'] },

        // B2B 
        { forward: 'Client', reverse: 'Service Provider', type: 'Professional', sourceTypes: ['organization'], targetTypes: ['organization'] },
        { forward: 'Company', reverse: 'Contractor', type: 'Professional', sourceTypes: ['organization'], targetTypes: ['organization'] },

        // Mixed (Person <-> Org) - e.g. Freelancer Client
        { forward: 'Client', reverse: 'Freelancer', type: 'Professional', sourceTypes: ['person'], targetTypes: ['person'] },

        // Investor
        { forward: 'Portfolio Company', reverse: 'Investor', type: 'Investor', sourceTypes: ['organization'], targetTypes: ['person', 'organization'] },
        { forward: 'Fund', reverse: 'LP (Limited Partner)', type: 'Investor', sourceTypes: ['organization'], targetTypes: ['person', 'organization'] },

        // Governance
        { forward: 'Board', reverse: 'Board Member', type: 'Governance', sourceTypes: ['organization'], targetTypes: ['person'] },
        { forward: 'Company', reverse: 'Advisor', type: 'Governance', sourceTypes: ['organization'], targetTypes: ['person'] },

        // Partnership (B2B)
        { forward: 'Partner', reverse: 'Partner', type: 'Default', sourceTypes: ['organization'], targetTypes: ['organization'] }
    ];

export const getAvailableRoles = (sourceType: 'person' | 'organization', targetType: 'person' | 'organization'): string[] => {
    const roles: Set<string> = new Set();

    RELATIONSHIP_PAIRS.forEach(pair => {
        // Check Forward Match (Source -> Target as defined)
        if (pair.sourceTypes.includes(sourceType) && pair.targetTypes.includes(targetType)) {
            // If I am Source, I see the Target's role (Reverse)
            // e.g. Org (Source) adds Person (Target). Role = Employee (Reverse)
            roles.add(pair.reverse);
        }

        // Check Reverse Match (Target -> Source as defined)
        // e.g. Person (Source) adds Org (Target). Defined is Org -> Person.
        else if (pair.targetTypes.includes(sourceType) && pair.sourceTypes.includes(targetType)) {
            // If I am Target (relative to definition), I see the Source's role (Forward)
            // e.g. Person (Source) adds Org (Target). Role = Employer (Forward)
            roles.add(pair.forward);
        }
    });

    // Special Person-Person cases not covered above
    if (sourceType === 'person' && targetType === 'person') {
        roles.add('Colleague');
        roles.add('Family');
        roles.add('Friend');
    }

    return Array.from(roles);
};
