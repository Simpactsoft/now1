"use client";

import { useState } from "react";
import { Plus, Loader2, Building2, X } from "lucide-react";
import { createTenant } from "@/app/actions/createTenant";
import { useRouter } from "next/navigation";

export default function AddTenantDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        slug: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await createTenant(formData);

            if (res.success) {
                setIsOpen(false);
                setFormData({ name: "", slug: "" });
                router.refresh(); // Refresh current view
            } else {
                setError(res.error || "Failed to create workspace");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all font-medium shadow-sm"
            >
                <Plus className="w-4 h-4" />
                <span>New Workspace</span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold">New Workspace</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Workspace Name (English Only)</label>
                        <input
                            required
                            type="text"
                            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="e.g. Apple Inc."
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Must contain only English letters, numbers, spaces, or dashes.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Slug (Optional)</label>
                        <input
                            type="text"
                            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="e.g. apple_inc"
                            value={formData.slug}
                            onChange={e => setFormData({ ...formData, slug: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Unique URL identifier (English/Latin only).
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Workspace
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
