import { z } from 'zod';

export const PaginatedQuerySchema = z.object({
    startRow: z.number().min(0).default(0),
    endRow: z.number().min(1).default(100),
    sortModel: z.array(z.object({
        colId: z.string(),
        sort: z.enum(['asc', 'desc'])
    })).optional().default([]),
    filterModel: z.record(z.any()).optional().default({}),
    tenantId: z.string().min(1, "Tenant ID is required"),
    query: z.string().optional()
});

export const CreatePersonSchema = z.object({
    firstName: z.string().min(2, "First Name is required"),
    lastName: z.string().min(2, "Last Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    tenantId: z.string().min(1, "Tenant ID is required")
});

export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

export const CreateOrganizationSchema = z.object({
    name: z.string().min(2, "Company Name is required"),
    taxId: z.string().optional(),
    companySize: z.string().optional(),
    industry: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    tenantId: z.string().min(1, "Tenant ID is required")
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const CreateTenantSchema = z.object({
    name: z.string()
        .min(2, "Workspace Name is required")
        .regex(/^[a-zA-Z0-9\s\-_.]+$/, "Name must contain only English letters, numbers, spaces, or dashes"),
    slug: z.string().optional()
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;

export type PaginatedQuery = z.infer<typeof PaginatedQuerySchema>;
