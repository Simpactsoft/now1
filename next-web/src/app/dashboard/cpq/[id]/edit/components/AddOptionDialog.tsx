"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Package, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/app/actions/cpq/template-actions";
import { createOption, updateOption, searchProducts } from "@/app/actions/cpq/option-actions";
import type { CatalogProduct } from "@/app/actions/cpq/option-actions";

interface AddOptionDialogProps {
    groupId: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingOption: Option | null;
}

type SourceMode = "manual" | "catalog";

export function AddOptionDialog({
    groupId,
    open,
    onClose,
    onSuccess,
    editingOption,
}: AddOptionDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Source mode
    const [sourceMode, setSourceMode] = useState<SourceMode>("manual");

    // Catalog search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [sku, setSku] = useState("");
    const [productId, setProductId] = useState<string | null>(null);
    const [priceModifierType, setPriceModifierType] = useState<
        "add" | "multiply" | "replace"
    >("add");
    const [priceModifierValue, setPriceModifierValue] = useState("0");
    const [imageUrl, setImageUrl] = useState("");
    const [isDefault, setIsDefault] = useState(false);

    // Reset form when dialog opens/editingOption changes
    useEffect(() => {
        if (open) {
            if (editingOption) {
                setName(editingOption.name);
                setDescription(editingOption.description || "");
                setSku(editingOption.sku || "");
                setProductId(editingOption.productId || null);
                setPriceModifierType(editingOption.priceModifierType);
                setPriceModifierValue(editingOption.priceModifierAmount.toString());
                setImageUrl(editingOption.imageUrl || "");
                setIsDefault(editingOption.isDefault);
                setSourceMode(editingOption.productId ? "catalog" : "manual");
                setSelectedProduct(null);
                setSearchQuery("");
                setSearchResults([]);
            } else {
                setName("");
                setDescription("");
                setSku("");
                setProductId(null);
                setPriceModifierType("add");
                setPriceModifierValue("0");
                setImageUrl("");
                setIsDefault(false);
                setSourceMode("manual");
                setSelectedProduct(null);
                setSearchQuery("");
                setSearchResults([]);
            }
        }
    }, [open, editingOption]);

    // Debounced product search
    const doSearch = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const result = await searchProducts(query);
        if (result.success && result.data) {
            setSearchResults(result.data);
        } else {
            setSearchResults([]);
        }
        setIsSearching(false);
    }, []);

    useEffect(() => {
        if (sourceMode !== "catalog") return;
        const timer = setTimeout(() => doSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery, sourceMode, doSearch]);

    // Select a product from catalog
    const handleSelectProduct = (product: CatalogProduct) => {
        setSelectedProduct(product);
        setProductId(product.id);
        setName(product.name);
        setSku(product.sku);
        setDescription(product.description || "");
        setPriceModifierType("add");
        setPriceModifierValue(product.listPrice.toString());
        setSearchQuery("");
        setSearchResults([]);
    };

    // Clear linked product
    const handleClearProduct = () => {
        setSelectedProduct(null);
        setProductId(null);
        setName("");
        setSku("");
        setDescription("");
        setPriceModifierValue("0");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

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
                productId: productId || undefined,
                priceModifierType,
                priceModifierValue: priceValue,
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingOption ? "Edit Option" : "Add Option"}
                    </DialogTitle>
                    <DialogDescription>
                        Define a choice within this option group
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Source Mode Toggle */}
                    {!editingOption && (
                        <div className="flex gap-2 p-1 bg-muted rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    setSourceMode("manual");
                                    handleClearProduct();
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${sourceMode === "manual"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Pencil className="h-4 w-4" />
                                Manual
                            </button>
                            <button
                                type="button"
                                onClick={() => setSourceMode("catalog")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${sourceMode === "catalog"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Package className="h-4 w-4" />
                                From Catalog
                            </button>
                        </div>
                    )}

                    {/* Catalog Search */}
                    {sourceMode === "catalog" && !selectedProduct && !editingOption && (
                        <div className="space-y-2">
                            <Label>Search Products</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or SKU..."
                                    className="pl-10"
                                    autoFocus
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                                    {searchResults.map((product) => (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => handleSelectProduct(product)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{product.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    SKU: {product.sku}
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                ₪{product.listPrice}
                                            </Badge>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">
                                    No products found. Try a different search term.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Selected Product Banner */}
                    {selectedProduct && (
                        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                <div>
                                    <span className="text-sm font-medium">{selectedProduct.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        SKU: {selectedProduct.sku}
                                    </span>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleClearProduct}
                                className="h-7 w-7"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Linked Product Info (editing mode) */}
                    {editingOption && productId && (
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Linked to catalog product</span>
                            <Badge variant="secondary" className="text-xs ml-auto">
                                {productId.slice(0, 8)}...
                            </Badge>
                        </div>
                    )}

                    {/* Show form fields when manual mode, OR product selected, OR editing */}
                    {(sourceMode === "manual" || selectedProduct || editingOption) && (
                        <>
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
                        </>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
