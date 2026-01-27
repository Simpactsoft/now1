"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { createPerson } from "@/app/actions/createPerson";
import { updatePerson } from "@/app/actions/updatePerson";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";

interface PersonData {
    id?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    status?: string;
    role?: string;
}

interface Props {
    tenantId: string;
    initialData?: PersonData; // If present, it's Edit mode
    trigger?: React.ReactNode;
}

export default function PersonFormDialog({ tenantId, initialData, trigger }: Props) {
    const { language } = useLanguage();
    const isEditMode = !!initialData?.id;
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Form State
    const [formData, setFormData] = useState<{
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        status: string;
        role: string;
        tags: string[];
    }>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        status: "",
        role: "",
        tags: []
    });

    // Options State
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Initialize Form Data when opening
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    firstName: initialData.firstName || "",
                    lastName: initialData.lastName || "",
                    email: initialData.email || "",
                    phone: initialData.phone || "",
                    status: initialData.status || "",
                    role: (initialData as any).role || (initialData as any).job_title || "",
                    tags: (initialData as any).tags || []
                });
            } else {
                setFormData({ firstName: "", lastName: "", email: "", phone: "", status: "", role: "", tags: [] });
            }
        }
    }, [isOpen, initialData]);

    // Fetch Status Options (Once per session or on open)
    useEffect(() => {
        if (isOpen && statusOptions.length === 0) {
            setLoadingStatus(true);
            fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
                .then(res => res.json())
                .then(json => {
                    if (json.data) setStatusOptions(json.data);
                    setLoadingStatus(false);
                })
                .catch(err => {
                    console.error("Failed to fetch status options", err);
                    setLoadingStatus(false);
                });
        }
    }, [isOpen, statusOptions.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const customFields: any = {};
            if (formData.status) customFields.status = formData.status;
            if (formData.role) customFields.role = formData.role;

            let res;
            if (isEditMode && initialData?.id) {
                // Update
                res = await updatePerson({
                    id: initialData.id,
                    tenantId,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    customFields,
                    tags: formData.tags
                });
            } else {
                // Create
                res = await createPerson({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    tenantId,
                    customFields,
                    tags: formData.tags
                });
            }

            if (res.success) {
                setIsOpen(false);
                if (!isEditMode) {
                    // Clear form on create success
                    setFormData({ firstName: "", lastName: "", email: "", phone: "", status: "", role: "" });

                    // Highlight newly created person
                    const params = new URLSearchParams(searchParams.toString());
                    if (res.data?.id) {
                        params.set('created', res.data.id);
                        router.replace(`${pathname}?${params.toString()}`);
                    }
                } else {
                    router.refresh();
                }
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
                        {isEditMode ? 'Edit Contact' : 'New Contact'}
                    </h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">First Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Omer"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Malka"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Email (Optional)</label>
                        <input
                            type="email"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="user@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Phone (Optional)</label>
                        <input
                            type="tel"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="+972-50-0000000"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    {/* Role Field */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Role (Job Title)</label>
                        <input
                            type="text"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="e.g. CEO"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        />
                    </div>

                    {/* Status Field */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Status</label>
                        <div className="relative">
                            <select
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors appearance-none"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                disabled={loadingStatus}
                            >
                                <option value="">{language === 'he' ? 'בחר סטטוס...' : 'Select Status...'}</option>
                                {statusOptions.map((opt: any) => {
                                    const label = opt.payload?.label_i18n?.[language] || opt.label || opt.value;
                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            {loadingStatus && <div className="absolute right-3 top-2.5"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                        </div>
                    </div>

                    {/* Tags Field (New) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Tags</label>
                        <div className="min-h-[42px] w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground focus-within:border-primary transition-colors flex flex-wrap gap-2 items-center">
                            {formData.tags?.map((tag: string) => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, tags: formData.tags.filter((t: string) => t !== tag) })}
                                        className="hover:text-primary/70"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                className="bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground flex-1 min-w-[80px]"
                                placeholder="Add tag + Enter..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val && !formData.tags?.includes(val)) {
                                            setFormData({ ...formData, tags: [...(formData.tags || []), val] });
                                            e.currentTarget.value = "";
                                        }
                                    }
                                }}
                            />
                        </div>
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
                            {isEditMode ? 'Save Changes' : 'Create Person'}
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
                    isDisabledDefault(isEditMode) ? (
                        <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-slate-200 transition-colors flex items-center gap-2">
                            <Pencil size={16} />
                            Edit Profile
                        </button>
                    ) : (
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all font-medium shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4" />
                            <span>Add Person</span>
                        </button>
                    )
                )}
            </div>
            {isOpen && createPortal(dialogContent, document.body)}
        </>
    );
}

function isDisabledDefault(isEdit: boolean) {
    return isEdit;
}
