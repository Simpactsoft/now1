
"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Building2 } from "lucide-react";
import { createOrganization } from "@/app/actions/createOrganization";
import { updateOrganization } from "@/app/actions/updateOrganization";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createPortal } from "react-dom";

// ... imports
import { useLanguage } from "@/context/LanguageContext";

interface OrganizationData {
    id?: string;
    name: string;
    status?: string;
    industry?: string;
    companySize?: string;
    website?: string;
    phone?: string;
    email?: string;
    tags?: string[];
}

interface Props {
    tenantId: string;
    initialData?: OrganizationData;
    trigger?: React.ReactNode;
    open?: boolean; // Controlled
    onOpenChange?: (open: boolean) => void;
    onSuccess?: (res?: any) => void;
    defaultName?: string;
}

export default function OrganizationFormDialog({ tenantId, initialData, trigger, open, onOpenChange, onSuccess, defaultName }: Props) {
    const { language } = useLanguage();
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
        status: string;
        tags: string[];
    }>({
        name: "",
        website: "",
        phone: "",
        email: "",
        industry: "",
        companySize: "",
        status: "",
        tags: []
    });

    // Options State
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch Status Options
    useEffect(() => {
        if (isOpen && statusOptions.length === 0) {
            setLoadingStatus(true);
            fetch(`/api/options?code=ORGANIZATION_STATUS&tenantId=${tenantId}`)
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
    }, [isOpen, statusOptions.length, tenantId]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || "",
                    website: initialData.website || "",
                    phone: initialData.phone || "",
                    email: initialData.email || "",
                    industry: initialData.industry || "",
                    companySize: initialData.companySize || "",
                    status: (initialData.status || "").toUpperCase(),
                    tags: initialData.tags || []
                });
            } else {
                setFormData({
                    name: defaultName || "",
                    website: "",
                    phone: "",
                    email: "",
                    industry: "",
                    companySize: "",
                    status: "",
                    tags: []
                });
            }
        }
    }, [isOpen, initialData, defaultName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const customFields: any = {};
            if (formData.status) customFields.status = formData.status;

            // TODO: Ensure backend supports 'tags' for organization if not already
            // Assuming the actions support `customFields` and `tags` conceptually similar to persons

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
                    website: formData.website,
                    customFields,
                    tags: formData.tags,
                    address: ""
                });
            } else {
                res = await createOrganization({
                    name: formData.name,
                    tenantId,
                    industry: formData.industry,
                    companySize: formData.companySize,
                    phone: formData.phone,
                    email: formData.email,
                    website: formData.website,
                    customFields,
                    tags: formData.tags,
                    address: ""
                });
            }

            if (res.success) {
                setIsOpen(false);
                if (onSuccess) onSuccess(res.data);
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
            <div className="bg-background border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground">
                        {isEditMode ? (language === 'he' ? 'ערוך ארגון' : 'Edit Organization') : (language === 'he' ? 'ארגון חדש' : 'New Organization')}
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
                        <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'שם הארגון' : 'Organization Name'}</label>
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
                            <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'תעשייה' : 'Industry'} (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Technology"
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'גודל חברה' : 'Company Size'} (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. 50-100"
                                value={formData.companySize}
                                onChange={e => setFormData({ ...formData, companySize: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'אימייל' : 'Email'} (Optional)</label>
                            <input
                                type="email"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="info@acme.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'טלפון' : 'Phone'} (Optional)</label>
                            <input
                                type="tel"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="+1 234 567 890"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'אתר אינטרנט' : 'Website'} (Optional)</label>
                        <input
                            type="url"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="https://example.com"
                            value={formData.website}
                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                        />
                    </div>

                    {/* Status Field */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'סטטוס' : 'Status'}</label>
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

                    {/* Tags Field */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{language === 'he' ? 'תגיות' : 'Tags'}</label>
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
                                placeholder={language === 'he' ? 'הוסף תגית + אנטר...' : 'Add tag + Enter...'}
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
                            {language === 'he' ? 'ביטול' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEditMode ? (language === 'he' ? 'שמור שינויים' : 'Save Changes') : (language === 'he' ? 'צור ארגון' : 'Create Organization')}
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
                        <span>{language === 'he' ? 'הוסף ארגון' : 'Add Organization'}</span>
                    </button>
                )}
            </div>
            {isOpen && createPortal(dialogContent, document.body)}
        </>
    );
}
