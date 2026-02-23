"use client";

import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Building, Calendar, User, Trash2, Check, Copy, FileText } from 'lucide-react';
import PersonFormDialog from './PersonFormDialog';
import EditableField from './universal/EditableField';
import { updatePerson } from '@/app/actions/updatePerson';
import { deletePerson } from '@/app/actions/deletePerson';
import { sendPortalMagicLink } from '@/app/actions/portal-auth-actions';
import { generatePortalTokenAction } from '@/app/actions/portal-auth';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '@/context/LanguageContext';
import { usePermission } from '@/context/SessionContext';
import { toast } from 'sonner';

interface ProfileHeaderProps {
    profile: any;
    tenantId: string;
}

export default function ProfileHeader({ profile, tenantId }: ProfileHeaderProps) {
    const { language } = useLanguage();
    const router = useRouter();
    const canDelete = usePermission('contacts.delete');

    // Status Options State
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);

    useEffect(() => {
        // Fetch Status Options
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options in Header", err));
    }, [tenantId]);

    const handleDelete = async () => {
        if (!confirm(language === 'he' ? "האם למחוק איש קשר זה? הפעולה אינה הפיכה." : "Are you sure you want to delete this contact? This action cannot be undone.")) return;

        try {
            const res = await deletePerson(profile.id);
            if (res.success) {
                toast.success(language === 'he' ? "איש הקשר נמחק" : "Contact deleted");
                router.push('/dashboard/people'); // Redirect to list
            } else {
                toast.error(res.error || (language === 'he' ? "שגיאה במחיקה" : "Failed to delete"));
            }
        } catch (e) {
            toast.error(language === 'he' ? "שגיאה בלתי צפויה" : "Unexpected error");
        }
    };

    if (!profile) return null;

    // Derive Names
    const fullName = profile.display_name || "";
    const nameParts = fullName.split(" ");
    const derivedFirstName = profile.first_name || nameParts[0] || "";
    const derivedLastName = profile.last_name || nameParts.slice(1).join(" ") || "";

    const handleSendPortalLink = async () => {
        setIsPortalMenuOpen(false);
        if (!profile.email) {
            toast.error(language === 'he' ? 'אין כתובת אימייל מוגדרת' : 'No email address defined');
            return;
        }
        const loadingToast = toast.loading(language === 'he' ? 'שולח לינק התחברות...' : 'Sending login link...');
        const res = await sendPortalMagicLink(profile.email);
        if (res.success) {
            toast.success(language === 'he' ? 'נשלח בהצלחה!' : 'Link sent perfectly!', { id: loadingToast });
        } else {
            toast.error(!res.success ? (res as any).error || "Failed to send link" : "Failed to send link", { id: loadingToast });
        }
    };

    const handleCopyPortalLink = async () => {
        setIsPortalMenuOpen(false);
        const loadingToast = toast.loading(language === 'he' ? 'מייצר לינק...' : 'Generating link...');
        try {
            const res = await generatePortalTokenAction(tenantId, profile.id);
            if (res.success && res.data) {
                await navigator.clipboard.writeText(res.data);
                toast.success(language === 'he' ? 'הלינק הועתק!' : 'Link copied to clipboard!', { id: loadingToast });
            } else if (!res.success) {
                toast.error(res.error || "Failed to generate link", { id: loadingToast });
            }
        } catch (err) {
            toast.error("Failed to generate link", { id: loadingToast });
        }
    };

    const handleUpdate = async (field: string, value: string) => {
        // Construct payload
        const payload: any = {
            id: profile.id, // This is Party ID
            tenantId,
            firstName: derivedFirstName,
            lastName: derivedLastName,
            email: (profile.email || "").trim(),
            phone: (profile.phone || "").trim()
        };

        const cleanValue = value.trim();

        if (field === 'display_name') {
            // Split name
            const parts = cleanValue.split(' ');
            payload.firstName = parts[0];
            payload.lastName = parts.slice(1).join(' ') || payload.lastName;
            if (parts.length === 1) payload.lastName = "";
        } else if (field === 'email') {
            payload.email = cleanValue;
        } else if (field === 'phone') {
            payload.phone = cleanValue;
        } else if (field === 'status') {
            payload.customFields = { status: value };
        } else if (field === 'role') {
            payload.customFields = { role: value };
            payload.jobTitle = value;
        }

        const res = await updatePerson(payload);
        if (res.success) {
            router.refresh();
        } else {
            console.error(res.error);
            toast.error(res.error || "Update failed");
        }
    };


    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(language === 'he' ? `${label} הועתק` : `${label} copied`);
    };

    return (
        <div className="bg-card p-8 rounded-3xl border border-border relative shadow-sm">
            {/* Background Gradient Blob - Wrapped to prevent overflow of content */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-64 h-64 bg-brand-primary/20 rounded-full blur-[80px]" />
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                {/* Avatar */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary p-[2px] shadow-2xl">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center">
                                <EditableField
                                    value={profile.display_name}
                                    onSave={(val) => handleUpdate('display_name', val)}
                                    className="hover:underline decoration-dashed underline-offset-4 decoration-primary/30 break-words"
                                    inputClassName="text-2xl font-bold bg-muted/50 border-input text-foreground rounded-lg px-2 py-1 min-w-[200px]"
                                    isMultiline={true}
                                />
                            </h1>
                            {profile.type && (
                                <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase font-bold tracking-widest text-muted-foreground border border-border shrink-0">
                                    {profile.type}
                                </span>
                            )}
                            <div className="relative flex items-center self-center shrink-0">
                                <div onClick={() => setIsStatusOpen(!isStatusOpen)} className="cursor-pointer hover:opacity-80 transition-opacity flex items-center">
                                    {(profile.status || profile.custom_fields?.status) ? (
                                        <StatusBadge status={profile.status || profile.custom_fields.status} tenantId={tenantId} />
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-widest border border-slate-200 whitespace-nowrap">
                                            No Status
                                        </span>
                                    )}
                                </div>

                                {isStatusOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsStatusOpen(false)} />
                                        <div className={`absolute top-full mt-2 min-w-[160px] bg-card border border-border rounded-xl shadow-xl z-50 py-1 flex flex-col animate-in fade-in zoom-in-95 duration-200 ${language === 'he' ? 'right-0' : 'left-0'}`}>
                                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border/50 mb-1">
                                                {language === 'he' ? 'שנה סטטוס' : 'Change Status'}
                                            </div>
                                            {statusOptions.map((opt: any) => {
                                                const label = opt.payload?.label_i18n?.[language] || opt.label || opt.value;
                                                const isSelected = (profile.status || profile.custom_fields?.status || "").toUpperCase() === opt.value.toUpperCase();
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => { handleUpdate('status', opt.value); setIsStatusOpen(false); }}
                                                        className="text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 relative"
                                                    >
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary absolute right-2" />}
                                                        <StatusBadge status={opt.value} tenantId={tenantId} options={[opt]} className="pointer-events-none" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-lg text-brand-secondary font-medium flex flex-wrap items-center gap-2">
                            <EditableField
                                value={profile.job_title || ""}
                                onSave={(val) => handleUpdate('role', val)}
                                placeholder="No Active Role"
                                className="hover:underline decoration-dashed break-words"
                                isMultiline={true}
                            />
                            {profile.employer && <span className="text-muted-foreground shrink-0">at {profile.employer}</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="group flex items-center gap-3 text-sm text-muted-foreground min-w-0 relative">
                            <Mail size={16} className="text-muted-foreground shrink-0" />
                            <EditableField
                                value={profile.email || ""}
                                onSave={(val) => handleUpdate('email', val)}
                                type="email"
                                placeholder="No email"
                                className="min-w-0"
                            />
                            {profile.email && (
                                <button
                                    onClick={() => handleCopy(profile.email, 'Email')}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground absolute right-0 bg-card/80 backdrop-blur-sm"
                                    title="Copy Email"
                                >
                                    <Copy size={13} />
                                </button>
                            )}
                        </div>
                        <div className="group flex items-center gap-3 text-sm text-muted-foreground min-w-0 relative">
                            <Phone size={16} className="text-muted-foreground shrink-0" />
                            <EditableField
                                value={profile.phone || ""}
                                onSave={(val) => handleUpdate('phone', val)}
                                type="tel"
                                placeholder="No phone"
                                className="min-w-0"
                            />
                            {profile.phone && (
                                <button
                                    onClick={() => handleCopy(profile.phone, 'Phone')}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground absolute right-0 bg-card/80 backdrop-blur-sm"
                                    title="Copy Phone"
                                >
                                    <Copy size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                            <MapPin size={16} className="text-muted-foreground shrink-0" />
                            <span className="truncate">{profile.city ? `${profile.city}, ${profile.country}` : "Location unknown"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                            <Calendar size={16} className="text-muted-foreground shrink-0" />
                            <span className="truncate">Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-3">
                    <PersonFormDialog
                        tenantId={tenantId}
                        initialData={{
                            id: profile.id,
                            firstName: derivedFirstName,
                            lastName: derivedLastName,
                            email: profile.email,
                            phone: profile.phone,
                            // Pass status from either source (custom_fields priority, then root)
                            status: profile.custom_fields?.status || profile.status,
                            // Pass role from job_title
                            role: profile.job_title,
                            tags: profile.tags
                        }}
                    />

                    <button
                        onClick={() => router.push(`/dashboard/sales/quotes/new?customerId=${profile.id}`)}
                        className="w-full px-4 py-2 bg-brand-primary text-primary-foreground font-semibold rounded-lg text-sm hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                    >
                        <FileText size={16} />
                        <span>{language === 'he' ? 'הצעת מחיר חדשה' : 'Create Quote'}</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setIsPortalMenuOpen(!isPortalMenuOpen)}
                            className="w-full px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold rounded-lg text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Mail size={16} />
                            <span>{language === 'he' ? 'חיבור לפורטל' : 'Portal Access'}</span>
                        </button>

                        {isPortalMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsPortalMenuOpen(false)} />
                                <div className="absolute top-12 right-0 w-full min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-sm">
                                    {profile.email && (
                                        <button
                                            onClick={handleSendPortalLink}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-100"
                                        >
                                            <Mail size={16} className="text-slate-400" />
                                            {language === 'he' ? 'שלח לינק במייל' : 'Send via Email'}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCopyPortalLink}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                        <Copy size={16} className="text-slate-400" />
                                        {language === 'he' ? 'העתק לינק לפורטל' : 'Copy Portal Link'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button className="px-4 py-2 bg-secondary text-foreground border border-border font-semibold rounded-lg text-sm hover:bg-secondary/80 transition-colors hidden">
                        Log Activity
                    </button>

                    {canDelete && (
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-lg text-sm hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            <span>{language === 'he' ? 'מחק איש קשר' : 'Delete Contact'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
