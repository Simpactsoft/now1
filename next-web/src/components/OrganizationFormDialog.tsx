
"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Building2 } from "lucide-react";
import { createOrganization } from "@/app/actions/createOrganization";
import { updateOrganization } from "@/app/actions/updateOrganization";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createPortal } from "react-dom";

interface OrganizationData {
    id?: string;
    name: string;
    status?: string;
    industry?: string;
    companySize?: string;
    website?: string;
    phone?: string;
    email?: string;
}

interface Props {
    tenantId: string;
    initialData?: OrganizationData;
    trigger?: React.ReactNode;
    open?: boolean; // Controlled
    onOpenChange?: (open: boolean) => void;
    onSuccess?: (res?: any) => void;
}

export default function OrganizationFormDialog({ tenantId, initialData, trigger, open, onOpenChange, onSuccess }: Props) {
    const isEditMode = !!initialData?.id;
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const setIsOpen = (val: boolean) => {
        if (!isControlled) setInternalOpen(val);
        onOpenChange?.(val);
    };

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<{
        name: string;
        website: string;
        phone: string;
        email: string;
        industry: string;
        companySize: string;
    }>({
        name: "",
        website: "",
        phone: "",
        email: "",
        industry: "",
        companySize: ""
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || "",
                    website: initialData.website || "",
                    phone: initialData.phone || "",
                    email: initialData.email || "",
                    industry: initialData.industry || "",
                    companySize: initialData.companySize || ""
                });
            } else {
                setFormData({ name: "", website: "", phone: "", email: "", industry: "", companySize: "" });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let res;
            if (isEditMode && initialData?.id) {
                res = await updateOrganization({
                    id: initialData.id,
                    tenantId,
                    name: formData.name,
                    industry: formData.industry,
                    companySize: formData.companySize,
                    phone: formData.phone,
                    email: formData.email,
                    address: "" // Not in form yet
                });
            } else {
                res = await createOrganization({
                    name: formData.name,
                    tenantId,
                    industry: formData.industry,
                    companySize: formData.companySize,
                    phone: formData.phone,
                    email: formData.email,
                    address: ""
                });
            }

            if (res.success) {
                setIsOpen(false);
                if (onSuccess) onSuccess(res.data); // Pass back the new org

                // If not using onSuccess or controlled, we might want to refresh
                // router.refresh(); 
            } else {
                setError(res.error || "Operation failed");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (!mounted) return null;

    const dialogContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground">
                        {isEditMode ? 'Edit Organization' : 'New Organization'}
                    </h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Organization Name</label>
                        <input
                            required
                            type="text"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="e.g. Acme Corp"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Industry (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Technology"
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Company Size (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. 50-100"
                                value={formData.companySize}
                                onChange={e => setFormData({ ...formData, companySize: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Email (Optional)</label>
                        <input
                            type="email"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="info@acme.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
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
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEditMode ? 'Save Changes' : 'Create Organization'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all font-medium shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" />
                        <span>Add Organization</span>
                    </button>
                )}
            </div>
            {isOpen && createPortal(dialogContent, document.body)}
        </>
    );
}
