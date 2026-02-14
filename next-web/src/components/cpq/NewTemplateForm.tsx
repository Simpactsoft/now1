"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { createTemplate } from "@/app/actions/cpq/template-actions";

interface NewTemplateFormProps {
    tenantId: string | null;
}

export default function NewTemplateForm({ tenantId }: NewTemplateFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        basePrice: "0",
        displayMode: "single_page" as "single_page" | "wizard",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Template name is required");
            return;
        }

        const basePrice = parseFloat(formData.basePrice);
        if (isNaN(basePrice) || basePrice < 0) {
            toast.error("Please enter a valid base price");
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createTemplate({
                name: formData.name.trim(),
                description: formData.description.trim() || undefined,
                basePrice,
                displayMode: formData.displayMode,
            });

            if (result.success && result.data) {
                toast.success("Template created successfully!");
                router.push(`/dashboard/cpq`);
            } else {
                toast.error(result.error || "Failed to create template");
            }
        } catch (error: any) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Template Details</CardTitle>
                    <CardDescription>
                        Fill in the basic information for your new configuration template
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Template Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Template Name *</Label>
                        <Input
                            id="name"
                            placeholder="e.g., Custom Laptop Configuration"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what this template is for..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                        />
                    </div>

                    {/* Base Price */}
                    <div className="space-y-2">
                        <Label htmlFor="basePrice">Base Price *</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="basePrice"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="pl-7"
                                value={formData.basePrice}
                                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Starting price before any options are added
                        </p>
                    </div>

                    {/* Display Mode */}
                    <div className="space-y-2">
                        <Label>Display Mode</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`
                                flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                                ${formData.displayMode === 'single_page'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'}
                            `}>
                                <input
                                    type="radio"
                                    name="displayMode"
                                    value="single_page"
                                    checked={formData.displayMode === 'single_page'}
                                    onChange={(e) => setFormData({ ...formData, displayMode: e.target.value as "single_page" })}
                                    className="sr-only"
                                />
                                <div className="text-center">
                                    <div className="font-medium">Single Page</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        All options on one page
                                    </div>
                                </div>
                            </label>

                            <label className={`
                                flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                                ${formData.displayMode === 'wizard'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'}
                            `}>
                                <input
                                    type="radio"
                                    name="displayMode"
                                    value="wizard"
                                    checked={formData.displayMode === 'wizard'}
                                    onChange={(e) => setFormData({ ...formData, displayMode: e.target.value as "wizard" })}
                                    className="sr-only"
                                />
                                <div className="text-center">
                                    <div className="font-medium">Wizard</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Step-by-step process
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={isSubmitting}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Template
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
