import { notFound } from "next/navigation";
import { getTemplateById } from "@/app/actions/cpq/template-actions";
import { TemplateEditor } from "./components/TemplateEditor";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function TemplateEditorPage({ params }: PageProps) {
    const { id } = await params;
    const result = await getTemplateById(id);

    if (!result.success || !result.data) {
        notFound();
    }

    const { template, optionGroups, rules, presets } = result.data;

    return (
        <TemplateEditor
            template={template}
            optionGroups={optionGroups}
            rules={rules}
            presets={presets}
        />
    );
}
