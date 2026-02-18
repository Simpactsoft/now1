import { z } from "zod";

export const priceBreakdownItemSchema = z.object({
    groupId: z.string().uuid(),
    groupName: z.string(),
    optionId: z.string().uuid(),
    optionName: z.string(),
    modifierType: z.enum(["add", "multiply", "replace"]),
    modifierAmount: z.number(),
    lineTotal: z.number(),
});

export const priceBreakdownSchema = z.array(priceBreakdownItemSchema);

export type PriceBreakdownItem = z.infer<typeof priceBreakdownItemSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
