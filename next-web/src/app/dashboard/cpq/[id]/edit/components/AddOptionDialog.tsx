"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/app/actions/cpq/template-actions";
import { createOption, updateOption } from "@/app/actions/cpq/option-actions";

interface AddOptionDialogProps {
    groupId: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingOption: Option | null;
}

export function AddOptionDialog({
    groupId,
    open,
    onClose,
    onSuccess,
    editingOption,
}: AddOptionDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form state
    const [name, setName] = useState(editingOption?.name || "");
    const [description, setDescription] = useState(editingOption?.description || "");
    const [sku, setSku] = useState(editingOption?.sku || "");
    const [priceModifierType, setPriceModifierType] = useState<
        "add" | "multiply" | "replace"
    >(editingOption?.priceModifierType || "add");
    const [priceModifierValue, setPriceModifierValue] = useState(
        editingOption?.priceModifierAmount?.toString() || "0"
    );
    const [imageUrl, setImageUrl] = useState(editingOption?.imageUrl || "");
    const [isDefault, setIsDefault] = useState(editingOption?.isDefault || false);

    // Reset form when dialog opens/closes or editingOption changes
    useState(() => {
        if (editingOption) {
            setName(editingOption.name);
            setDescription(editingOption.description || "");
            setSku(editingOption.sku || "");
            setPriceModifierType(editingOption.priceModifierType);
            setPriceModifierValue(editingOption.priceModifierAmount.toString());
            setImageUrl(editingOption.imageUrl || "");
            setIsDefault(editingOption.isDefault);
        } else {
            setName("");
            setDescription("");
            setSku("");
            setPriceModifierType("add");
            setPriceModifierValue("0");
            setImageUrl("");
            setIsDefault(false);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        const priceValue = parseFloat(priceModifierValue);
        if (isNaN(priceValue)) {
            toast.error("Price modifier must be a valid number");
            return;
        }

        startTransition(async () => {
            const params = {
                name: name.trim(),
                description: description.trim() || undefined,
                sku: sku.trim() || undefined,
                priceModifierType,
                priceModifierAmount: priceValue,
                imageUrl: imageUrl.trim() || undefined,
                isDefault,
            };

            const result = editingOption
                ? await updateOption(editingOption.id, params)
                : await createOption(groupId, params);

            if (result.success) {
                toast.success(editingOption ? "Option updated" : "Option created");
                onSuccess();
                onClose();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to save option");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {editingOption ? "Edit Option" : "Add Option"}
                    </DialogTitle>
                    <DialogDescription>
                        Define a choice within this option group
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <Label htmlFor="name">
                            Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Small, Medium, Large"
                            disabled={isPending}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description for users"
                            rows={2}
                            disabled={isPending}
                        />
                    </div>

                    {/* SKU */}
                    <div>
                        <Label htmlFor="sku">SKU</Label>
                        <Input
                            id="sku"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder="Optional SKU code"
                            disabled={isPending}
                        />
                    </div>

                    {/* Price Modifier */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Price Modifier Type</Label>
                            <Select
                                value={priceModifierType}
                                onValueChange={(value: "add" | "multiply" | "replace") =>
                                    setPriceModifierType(value)
                                }
                                disabled={isPending}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="add">Add (+/-)</SelectItem>
                                    <SelectItem value="multiply">Multiply (×)</SelectItem>
                                    <SelectItem value="replace">Replace (=)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="priceValue">
                                Value{" "}
                                {priceModifierType === "add" && "(can be negative)"}
                            </Label>
                            <Input
                                id="priceValue"
                                type="number"
                                step="0.01"
                                value={priceModifierValue}
                                onChange={(e) => setPriceModifierValue(e.target.value)}
                                placeholder="0"
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    {/* Explanation */}
                    <p className="text-xs text-muted-foreground">
                        {priceModifierType === "add" &&
                            `Add ${priceModifierValue} to base price`}
                        {priceModifierType === "multiply" &&
                            `Multiply base price by ${priceModifierValue}`}
                        {priceModifierType === "replace" &&
                            `Replace base price with ${priceModifierValue}`}
                    </p>

                    {/* Image URL */}
                    <div>
                        <Label htmlFor="imageUrl">Image URL</Label>
                        <Input
                            id="imageUrl"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={isPending}
                        />
                        {imageUrl && (
                            <div className="mt-2">
                                <img
                                    src={imageUrl}
                                    alt="Preview"
                                    className="h-20 w-20 object-cover rounded border"
                                    onError={(e) => {
                                        e.currentTarget.src = "";
                                        e.currentTarget.alt = "Invalid image URL";
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Is Default */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="isDefault">Default Selection</Label>
                            <p className="text-xs text-muted-foreground">
                                Pre-select this option by default
                            </p>
                        </div>
                        <Switch
                            id="isDefault"
                            checked={isDefault}
                            onCheckedChange={setIsDefault}
                            disabled={isPending}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingOption ? "Update Option" : "Create Option"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
