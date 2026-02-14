"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PriceCalculation } from "../hooks/client-pricing";
import { Save, Share, ShoppingCart, Loader2 } from "lucide-react";

interface PriceSummaryProps {
    pricing: PriceCalculation | null;
    quantity: number;
    onQuantityChange: (qty: number) => void;
    onSave: () => void;
    onShare: () => void;
    onAddToQuote: () => void;
    isSaving: boolean;
    isCalculating: boolean;
    canAddToQuote: boolean;
}

/**
 * PriceSummary - Sticky panel showing running total and actions.
 * Always visible on right side (desktop) or bottom (mobile).
 */
export function PriceSummary({
    pricing,
    quantity,
    onQuantityChange,
    onSave,
    onShare,
    onAddToQuote,
    isSaving,
    isCalculating,
    canAddToQuote,
}: PriceSummaryProps) {
    if (!pricing) {
        return (
            <div className="sticky top-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Price Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Select options to see pricing
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="sticky top-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Price Summary</span>
                        {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Quantity */}
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24"
                        />
                    </div>

                    <Separator />

                    {/* Price breakdown */}
                    <TooltipProvider>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Base Price</span>
                                <span>${pricing.basePrice.toFixed(2)}</span>
                            </div>

                            {pricing.breakdown.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="text-muted-foreground truncate max-w-[180px] cursor-help">
                                                {item.optionName}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{item.optionName}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <span>
                                        {item.modifierType === "add" && item.modifierAmount > 0 && "+"}
                                        ${item.modifierAmount.toFixed(2)}
                                    </span>
                                </div>
                            ))}

                            {pricing.optionsTotal !== 0 && (
                                <div className="flex justify-between font-medium pt-2">
                                    <span>Options Total</span>
                                    <span>${pricing.optionsTotal.toFixed(2)}</span>
                                </div>
                            )}

                            {pricing.discounts.length > 0 && (
                                <>
                                    <Separator />
                                    {pricing.discounts.map((discount, idx) => (
                                        <div key={idx} className="flex justify-between text-green-600">
                                            <span>{discount.name}</span>
                                            <span>-${discount.amount.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </TooltipProvider>

                    <Separator />

                    {/* Total */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>${pricing.total.toFixed(2)}</span>
                        </div>
                        {quantity > 1 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Per unit</span>
                                <span>${pricing.perUnitPrice.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="space-y-2">
                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            variant="outline"
                            className="w-full"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Configuration
                                </>
                            )}
                        </Button>

                        <Button onClick={onShare} variant="outline" className="w-full">
                            <Share className="mr-2 h-4 w-4" />
                            Share
                        </Button>

                        <Button
                            onClick={onAddToQuote}
                            disabled={!canAddToQuote || isSaving}
                            className="w-full"
                        >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to Quote
                        </Button>
                    </div>

                    {/* Info */}
                    <div className="text-xs text-muted-foreground text-center">
                        Prices are calculated in real-time
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
