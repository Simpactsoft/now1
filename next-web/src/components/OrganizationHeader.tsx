"use client";

import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Building, Globe, Trash2, Copy, Pencil } from 'lucide-react';
import OrganizationFormDialog from './OrganizationFormDialog';
import EditableField from './universal/EditableField';
import { updateOrganization } from '@/app/actions/updateOrganization';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '@/context/LanguageContext';
import { usePermission } from '@/context/SessionContext';
import { toast } from 'sonner';

interface OrganizationHeaderProps {
    profile: any;
    tenantId: string;
}

export default function OrganizationHeader({ profile, tenantId }: OrganizationHeaderProps) {
    const { language } = useLanguage();
    const router = useRouter();
    // Reuse contact permissions for now, or add specific org permissions
    const canDelete = usePermission('contacts.delete');

    // Status Options State
    const [statusOptions, setStatusOptions] = useState<any[]>([]);
    const [isStatusOpen, setIsStatusOpen] = useState(false);

    useEffect(() => {
        // Fetch Organization Status Options
        fetch(`/api/options?code=ORGANIZATION_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options", err));
    }, [tenantId]);

    if (!profile) return null;

    const handleUpdate = async (field: string, value: string) => {
        const payload: any = {
            id: profile.id,
            tenantId,
        };

        if (field === 'display_name') payload.displayName = value;
        else if (field === 'email') payload.email = value;
        else if (field === 'phone') payload.phone = value;
        else if (field === 'website') payload.website = value;
        else if (field === 'status') payload.customFields = { status: value };
        else if (field === 'industry') payload.customFields = { industry: value };
        else if (field === 'city') payload.customFields = { city: value }; // Simple update if needed

        console.log("[OrganizationHeader] Sending Update Payload:", payload);


        const res = await updateOrganization(payload);
        if (res.success) {
            router.refresh();
        } else {
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
            {/* Background Gradient Blob */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                {/* Logo / Avatar */}
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 p-[2px] shadow-xl">
                    <div className="w-full h-full rounded-3xl bg-white flex items-center justify-center overflow-hidden border border-white/50">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                            <Building size={48} className="text-blue-300" />
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
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] uppercase font-bold tracking-widest border border-blue-100 shrink-0">
                                {language === 'he' ? 'ארגון' : 'Organization'}
                            </span>
                            <div className="relative flex items-center self-center shrink-0">
                                <div onClick={() => setIsStatusOpen(!isStatusOpen)} className="cursor-pointer hover:opacity-80 transition-opacity flex items-center">
                                    {(profile.status || profile.custom_fields?.status) ? (
                                        <StatusBadge status={profile.status || profile.custom_fields.status} tenantId={tenantId} />
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-widest border border-slate-200 whitespace-nowrap">
                                            Unknown Status
                                        </span>
                                    )}
                                </div>

                                {isStatusOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsStatusOpen(false)} />
                                        <div className={`absolute top-full mt-2 min-w-[160px] bg-card border border-border rounded-xl shadow-xl z-50 py-1 flex flex-col animate-in fade-in zoom-in-95 duration-200 ${language === 'he' ? 'right-0' : 'left-0'}`}>
                                            {statusOptions.map((opt: any) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => { handleUpdate('status', opt.value); setIsStatusOpen(false); }}
                                                    className="text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                                                >
                                                    <StatusBadge status={opt.value} tenantId={tenantId} options={[opt]} className="pointer-events-none" />
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Industry */}
                        <div className="text-lg text-muted-foreground font-medium flex items-center gap-2">
                            <Building size={16} />
                            <EditableField
                                value={profile.industry || profile.custom_fields?.industry || ""}
                                onSave={(val) => handleUpdate('industry', val)}
                                placeholder="Add Industry"
                                className="hover:underline decoration-dashed break-words"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {/* Website */}
                        <div className="group flex items-center gap-3 text-sm text-muted-foreground min-w-0 relative">
                            <Globe size={16} className="text-muted-foreground shrink-0" />
                            <EditableField
                                value={profile.website || ""}
                                onSave={(val) => handleUpdate('website', val)}
                                placeholder="Add Website"
                                className="min-w-0 text-blue-600 hover:text-blue-700"
                            />
                            {profile.website && (
                                <a
                                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute right-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted rounded-md transition-opacity"
                                >
                                    <Globe size={13} />
                                </a>
                            )}
                        </div>

                        {/* Email */}
                        <div className="group flex items-center gap-3 text-sm text-muted-foreground min-w-0 relative">
                            <Mail size={16} className="text-muted-foreground shrink-0" />
                            <EditableField
                                value={profile.email || ""}
                                onSave={(val) => handleUpdate('email', val)}
                                placeholder="Add Email"
                                className="min-w-0"
                            />
                            {profile.email && (
                                <button
                                    onClick={() => handleCopy(profile.email, 'Email')}
                                    className="p-1.5 hover:bg-muted rounded-md absolute right-0 bg-card/80 border border-border/10 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Copy size={13} />
                                </button>
                            )}
                        </div>

                        {/* Phone */}
                        <div className="group flex items-center gap-3 text-sm text-muted-foreground min-w-0 relative">
                            <Phone size={16} className="text-muted-foreground shrink-0" />
                            <EditableField
                                value={profile.phone || ""}
                                onSave={(val) => handleUpdate('phone', val)}
                                placeholder="Add Phone"
                                className="min-w-0"
                            />
                            {profile.phone && (
                                <button
                                    onClick={() => handleCopy(profile.phone, 'Phone')}
                                    className="p-1.5 hover:bg-muted rounded-md absolute right-0 bg-card/80 border border-border/10 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Copy size={13} />
                                </button>
                            )}
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0">
                            <MapPin size={16} className="text-muted-foreground shrink-0" />
                            <span className="truncate">
                                {[profile.city, profile.country].filter(Boolean).join(", ") || "Location unknown"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-3">
                    <OrganizationFormDialog
                        tenantId={tenantId}
                        initialData={{
                            id: profile.id,
                            name: profile.display_name,
                            industry: profile.industry || profile.custom_fields?.industry,
                            companySize: profile.company_size || profile.custom_fields?.company_size,
                            website: profile.website,
                            phone: profile.phone,
                            email: profile.email,
                            status: profile.status || profile.custom_fields?.status
                        }}
                        trigger={
                            <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-slate-200 transition-colors flex items-center gap-2">
                                <Pencil size={16} />
                                {language === 'he' ? 'ערוך פרופיל' : 'Edit Profile'}
                            </button>
                        }
                        onSuccess={() => router.refresh()}
                    />

                    {canDelete && (
                        <button
                            onClick={() => {
                                if (confirm(language === 'he' ? "האם למחוק ארגון זה?" : "Are you sure you want to delete this organization?")) {
                                    // TODO: Implement delete organization action
                                    toast.error("Delete not implemented yet");
                                }
                            }}
                            className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-lg text-sm hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} />
                            <span>{language === 'he' ? 'מחק ארגון' : 'Delete Organization'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
