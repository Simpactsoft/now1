"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Trash2, Copy, Download, Upload, MoreHorizontal, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type {
    ProductTemplate,
    OptionGroup,
    ConfigurationRule,
    TemplatePreset,
} from "@/app/actions/cpq/template-actions";
import {
    deleteTemplates,
    duplicateTemplate,
    exportTemplateAsJson,
    importTemplateFromJson,
    validateTemplateForPublish,
    toggleTemplateActive,
} from "@/app/actions/cpq/template-actions";
import { TemplateSettingsForm } from "./TemplateSettingsForm";
import { OptionGroupsPlaceholder } from "./OptionGroupsPlaceholder";
import { RulesManager } from "./RulesManager";
import { PresetsManager } from "./PresetsManager";
import { ConfiguratorPreview } from "./ConfiguratorPreview";
import { AuditLogTab } from "./AuditLogTab";

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
    const [isDeleting, startDelete] = useTransition();
    const [isDuplicating, startDuplicate] = useTransition();
    const [isPublishing, startPublish] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // ---- Delete ----
    const handleDeleteTemplate = () => {
        const confirmed = window.confirm(
            `האם אתה בטוח שברצונך למחוק את "${template.name}"?\nכל הקבוצות, האופציות, הכללים וה-Presets ימחקו לצמיתות.`
        );
        if (!confirmed) return;

        startDelete(async () => {
            const result = await deleteTemplates([template.id]);
            if (result.success) {
                toast.success("התבנית נמחקה בהצלחה");
                router.push("/dashboard/cpq");
            } else {
                toast.error(result.error || "שגיאה במחיקת התבנית");
            }
        });
    };

    // ---- Duplicate ----
    const handleDuplicate = () => {
        startDuplicate(async () => {
            const result = await duplicateTemplate(template.id);
            if (result.success && result.data) {
                toast.success("התבנית שוכפלה בהצלחה");
                router.push(`/dashboard/cpq/${result.data.id}/edit`);
            } else {
                toast.error(result.error || "שגיאה בשכפול התבנית");
            }
        });
    };

    // ---- Export JSON ----
    const handleExport = async () => {
        const result = await exportTemplateAsJson(template.id);
        if (result.success && result.data) {
            const blob = new Blob([result.data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${template.name.replace(/\s+/g, "_")}_template.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("התבנית יוצאה בהצלחה");
        } else {
            toast.error(result.error || "שגיאה בייצוא");
        }
    };

    // ---- Import JSON ----
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const result = await importTemplateFromJson(text);
            if (result.success && result.data) {
                toast.success("התבנית יובאה בהצלחה");
                router.push(`/dashboard/cpq/${result.data.id}/edit`);
            } else {
                toast.error(result.error || "שגיאה בייבוא");
            }
        } catch {
            toast.error("שגיאה בקריאת הקובץ");
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ---- Publish / Unpublish with validation ----
    const handleTogglePublish = () => {
        startPublish(async () => {
            if (!template.isActive) {
                // Validate before publishing
                const validation = await validateTemplateForPublish(template.id);
                if (!validation.valid) {
                    toast.error(
                        <div className="space-y-1">
                            <p className="font-medium">לא ניתן לפרסם — נמצאו בעיות:</p>
                            <ul className="list-disc list-inside text-sm">
                                {validation.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>,
                        { duration: 8000 }
                    );
                    return;
                }
            }

            const result = await toggleTemplateActive(template.id);
            if (result.success) {
                toast.success(result.data?.isActive ? "התבנית פורסמה" : "התבנית הועברה לטיוטה");
                router.refresh();
            } else {
                toast.error(result.error || "שגיאה בעדכון סטטוס");
            }
        });
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
            />

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

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {/* Publish / Unpublish */}
                    <Button
                        variant={template.isActive ? "outline" : "default"}
                        size="sm"
                        onClick={handleTogglePublish}
                        disabled={isPublishing}
                        className="flex items-center gap-2"
                    >
                        {template.isActive ? (
                            <>
                                <AlertTriangle className="h-4 w-4" />
                                {isPublishing ? "מעדכן..." : "העבר לטיוטה"}
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                {isPublishing ? "מפרסם..." : "פרסם"}
                            </>
                        )}
                    </Button>

                    {/* More Actions Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
                                <Copy className="h-4 w-4 mr-2" />
                                {isDuplicating ? "משכפל..." : "שכפל תבנית"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExport}>
                                <Download className="h-4 w-4 mr-2" />
                                ייצוא JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" />
                                ייבוא JSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleDeleteTemplate}
                                disabled={isDeleting}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isDeleting ? "מוחק..." : "מחק תבנית"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                    <TabsTrigger value="history">History</TabsTrigger>
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
                    <RulesManager templateId={template.id} rules={rules} optionGroups={optionGroups} />
                </TabsContent>

                <TabsContent value="presets" className="space-y-6">
                    <PresetsManager templateId={template.id} presets={presets} optionGroups={optionGroups} />
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                    <ConfiguratorPreview template={template} optionGroups={optionGroups} rules={rules} presets={presets} />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <AuditLogTab templateId={template.id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
