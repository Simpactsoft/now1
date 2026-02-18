"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Eye, EyeOff, ImageIcon } from "lucide-react";
import type { ProductTemplate } from "@/app/actions/cpq/template-actions";
import { updateTemplate, toggleTemplateActive } from "@/app/actions/cpq/template-actions";

interface TemplateSettingsFormProps {
    template: ProductTemplate;
}

export function TemplateSettingsForm({ template }: TemplateSettingsFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isTogglingActive, setIsTogglingActive] = useState(false);

    // Form state
    const [name, setName] = useState(template.name);
    const [description, setDescription] = useState(template.description || "");
    const [basePrice, setBasePrice] = useState(template.basePrice.toString());
    const [displayMode, setDisplayMode] = useState<"single_page" | "wizard">(
        template.displayMode
    );
    const [imageUrl, setImageUrl] = useState(template.imageUrl || "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            toast.error("Template name is required");
            return;
        }

        const parsedPrice = parseFloat(basePrice);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            toast.error("Base price must be a valid number ≥ 0");
            return;
        }

        startTransition(async () => {
            const result = await updateTemplate(template.id, {
                name: name.trim(),
                description: description.trim() || undefined,
                basePrice: parsedPrice,
                displayMode,
                imageUrl: imageUrl.trim() || undefined,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Template settings saved successfully");
                router.refresh();
            }
        });
    };

    const handleToggleActive = async () => {
        setIsTogglingActive(true);
        const result = await toggleTemplateActive(template.id);
        setIsTogglingActive(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            const newStatus = result.data?.isActive ? "published" : "unpublished";
            toast.success(`Template ${newStatus} successfully`);
            router.refresh();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                        Configure the core settings for your product configurator
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Template Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Custom Gaming PC Builder"
                            required
                        />
                        <p className="text-sm text-muted-foreground">
                            A descriptive name for your configurator (shown to customers)
                        </p>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what this configurator is for..."
                            rows={3}
                        />
                    </div>

                    {/* Base Price */}
                    <div className="space-y-2">
                        <Label htmlFor="basePrice">
                            Base Price <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="basePrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={basePrice}
                            onChange={(e) => setBasePrice(e.target.value)}
                            required
                        />
                        <p className="text-sm text-muted-foreground">
                            Starting price before any options are added (in your currency)
                        </p>
                    </div>

                    {/* Display Mode */}
                    <div className="space-y-2">
                        <Label htmlFor="displayMode">Display Mode</Label>
                        <Select value={displayMode} onValueChange={(value: any) => setDisplayMode(value)}>
                            <SelectTrigger id="displayMode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="single_page">
                                    Single Page (All groups visible)
                                </SelectItem>
                                <SelectItem value="wizard">
                                    Wizard (Step-by-step)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Single Page: Apple-style, show all options at once. Wizard: Step-by-step BMW-style
                        </p>
                    </div>

                    {/* Image URL */}
                    <div className="space-y-2">
                        <Label htmlFor="imageUrl">Product Image</Label>
                        <Input
                            id="imageUrl"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/product-image.jpg"
                        />
                        <p className="text-sm text-muted-foreground">
                            Hero image displayed in the configurator header
                        </p>
                        {imageUrl ? (
                            <div className="mt-2 rounded-lg border overflow-hidden bg-muted/30 p-2">
                                <img
                                    src={imageUrl}
                                    alt="Product preview"
                                    className="max-h-48 w-auto mx-auto object-contain rounded"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="mt-2 flex items-center justify-center h-32 rounded-lg border-2 border-dashed bg-muted/20">
                                <div className="text-center text-muted-foreground">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-30" />
                                    <p className="text-xs">No image set</p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Publishing */}
            <Card>
                <CardHeader>
                    <CardTitle>Publishing</CardTitle>
                    <CardDescription>
                        Control whether this template is visible to end users
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Template Status</Label>
                            <p className="text-sm text-muted-foreground">
                                {template.isActive
                                    ? "Published - visible to customers"
                                    : "Draft - only visible to admins"}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant={template.isActive ? "outline" : "default"}
                            onClick={handleToggleActive}
                            disabled={isTogglingActive}
                        >
                            {isTogglingActive ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : template.isActive ? (
                                <EyeOff className="h-4 w-4 mr-2" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            {template.isActive ? "Unpublish" : "Publish"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
                <Button type="submit" disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
