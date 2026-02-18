import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import NewTemplateForm from "@/components/cpq/NewTemplateForm";
import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/tenant";

export default async function NewTemplatePage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    const supabase = await createClient();
    const tenantId = await getTenantId(user, supabase);

    return (
        <div className="container max-w-2xl mx-auto py-8 px-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Create New Template</h1>
                <p className="text-muted-foreground mt-2">
                    Create a new CPQ configuration template to use with your products.
                </p>
            </div>

            <NewTemplateForm tenantId={tenantId} />
        </div>
    );
}
