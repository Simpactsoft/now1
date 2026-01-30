"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deletePerson(id: string) {
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from("cards")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("[deletePerson] Error:", error);
            if (error.code === '42501' || error.message.includes('permission')) {
                return { success: false, error: "Unauthorized: You do not have permission to delete contacts." };
            }
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard/people");
        return { success: true };
    } catch (err: any) {
        console.error("[deletePerson] Exception:", err);
        return { success: false, error: "Failed to delete person." };
    }
}
