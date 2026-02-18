"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ActionResult, actionOk, actionError } from "@/lib/action-result";

export async function deletePerson(id: string): Promise<ActionResult<void>> {
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from("cards")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("[deletePerson] Error:", error);
            if (error.code === '42501' || error.message.includes('permission')) {
                return actionError("Unauthorized: You do not have permission to delete contacts.", "AUTH_ERROR");
            }
            return actionError(error.message, "DB_ERROR");
        }

        revalidatePath("/dashboard/people");
        return actionOk();
    } catch (err: any) {
        console.error("[deletePerson] Exception:", err);
        return actionError("Failed to delete person.");
    }
}
