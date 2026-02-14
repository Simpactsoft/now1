"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type {
    ProductTemplate,
    OptionGroup,
    ConfigurationRule,
    TemplatePreset,
} from "@/app/actions/cpq/template-actions";
import { TemplateSettingsForm } from "./TemplateSettingsForm";
import { OptionGroupsPlaceholder } from "./OptionGroupsPlaceholder";
import { RulesPlaceholder } from "./RulesPlaceholder";
import { PresetsPlaceholder } from "./PresetsPlaceholder";
import { PreviewPlaceholder } from "./PreviewPlaceholder";

interface TemplateEditorProps {
    template: ProductTemplate;
    optionGroups: OptionGroup[];
    rules: ConfigurationRule[];
    presets: TemplatePreset[];
}

export function TemplateEditor({
    template,
    optionGroups,
    rules,
    presets,
}: TemplateEditorProps) {
    const [activeTab, setActiveTab] = useState("settings");

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/cpq">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{template.name}</h1>
                            <Badge variant={template.isActive ? "default" : "secondary"}>
                                {template.isActive ? "Published" : "Draft"}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure your product template settings, option groups, rules, and presets
                        </p>
                    </div>
                </div>
            </div>

            {/* Breadcrumbs */}
            <div className="text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground">
                    Dashboard
                </Link>
                {" > "}
                <Link href="/dashboard/cpq" className="hover:text-foreground">
                    CPQ
                </Link>
                {" > "}
                <span className="text-foreground">{template.name}</span>
                {" > "}
                <span className="text-foreground">Edit</span>
            </div>

            {/* Tabbed Interface */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="groups">
                        Option Groups ({optionGroups.length})
                    </TabsTrigger>
                    <TabsTrigger value="rules">
                        Rules ({rules.length})
                    </TabsTrigger>
                    <TabsTrigger value="presets">
                        Presets ({presets.length})
                    </TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-6">
                    <TemplateSettingsForm template={template} />
                </TabsContent>

                <TabsContent value="groups" className="space-y-6">
                    <OptionGroupsPlaceholder
                        templateId={template.id}
                        optionGroups={optionGroups}
                    />
                </TabsContent>

                <TabsContent value="rules" className="space-y-6">
                    <RulesPlaceholder templateId={template.id} rules={rules} />
                </TabsContent>

                <TabsContent value="presets" className="space-y-6">
                    <PresetsPlaceholder templateId={template.id} presets={presets} />
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                    <PreviewPlaceholder template={template} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
