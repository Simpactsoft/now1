import { z } from "zod";

export const sourceSnapshotOptionSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    priceModifierType: z.string(),
    priceModifierAmount: z.number(),
});

export const sourceSnapshotGroupSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    options: z.array(sourceSnapshotOptionSchema),
});

export const sourceSnapshotSchema = z.object({
    clonedAt: z.string(),
    sourceType: z.enum(["configuration", "template"]),
    templateId: z.string().uuid(),
    templateName: z.string(),
    basePrice: z.number(),
    optionGroups: z.array(sourceSnapshotGroupSchema),
    selectedOptions: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    totalPrice: z.number(),
});

export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
