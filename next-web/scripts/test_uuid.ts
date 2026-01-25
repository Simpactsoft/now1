
import { z } from "zod";

const UpdatePersonSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
});

const tenantId = "00000000-0000-0000-0000-000000000003";

try {
    const result = UpdatePersonSchema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        tenantId: tenantId
    });
    console.log("Validation passed");
} catch (e) {
    console.error("Validation failed", e);
}
