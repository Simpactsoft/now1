"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setTenantAction(tenantId: string) {
    const cookieStore = await cookies();
    cookieStore.set("tenant_id", tenantId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        sameSite: "lax",
    });

    revalidatePath("/dashboard");
}
