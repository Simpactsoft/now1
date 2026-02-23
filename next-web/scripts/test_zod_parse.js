const { z } = require('zod');

const UpdateOrgSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    displayName: z.string().optional(),
    email: z.string().nullish(), // string | null | undefined
    phone: z.string().nullish(),
    website: z.string().nullish(),
    customFields: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).optional()
});

const params = {
    id: "123",
    tenantId: "456",
    customFields: { status: "ACTIVE" }
};

const result = UpdateOrgSchema.safeParse(params);
console.log(JSON.stringify(result, null, 2));
