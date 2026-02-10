"use client";

import { useState } from "react";
import BomDialog from "@/components/products/BomDialog";

interface ProductActionsProps {
    productId: string;
    productName: string;
}

export default function ProductActions({ productId, productName }: ProductActionsProps) {
    const [showBomDialog, setShowBomDialog] = useState(false);

    return (
        <>
            <div className="mt-6 flex gap-3">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    Edit Product
                </button>
                <button
                    onClick={() => setShowBomDialog(true)}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                    View BOM
                </button>
                <button className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors">
                    Inventory History
                </button>
            </div>

            <BomDialog
                productId={productId}
                productName={productName}
                isOpen={showBomDialog}
                onClose={() => setShowBomDialog(false)}
            />
        </>
    );
}
