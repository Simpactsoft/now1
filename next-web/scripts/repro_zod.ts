
import { CreatePersonSchema } from "../src/lib/schemas";

console.log("CreatePersonSchema:", CreatePersonSchema);

try {
    const params = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "123456789",
        tenantId: "tenant-123",
        customFields: {}
    };

    console.log("Attempting to parse:", params);
    const result = CreatePersonSchema.safeParse(params);
    console.log("Result:", result);
} catch (error) {
    console.error("Error during parse:", error);
}
