import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { redirect } from "next/navigation";
import NewTemplateForm from "@/components/cpq/NewTemplateForm";

export default async function NewTemplatePage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id || null;

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
