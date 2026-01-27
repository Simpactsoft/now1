"use client";

import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Building, Calendar, User } from 'lucide-react';
import PersonFormDialog from './PersonFormDialog';
import EditableField from './universal/EditableField';
import { updatePerson } from '@/app/actions/updatePerson';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '@/context/LanguageContext';

interface ProfileHeaderProps {
    profile: any;
    tenantId: string;
}

export default function ProfileHeader({ profile, tenantId }: ProfileHeaderProps) {
    const { language } = useLanguage();
    console.log("ProfileHeader received tenantId:", tenantId);

    // Status Options State
    const [statusOptions, setStatusOptions] = useState<any[]>([]);

    useEffect(() => {
        // Fetch Status Options
        fetch(`/api/options?code=PERSON_STATUS&tenantId=${tenantId}`)
            .then(res => res.json())
            .then(json => {
                if (json.data) setStatusOptions(json.data);
            })
            .catch(err => console.error("Failed to fetch status options in Header", err));
    }, [tenantId]);

    if (!profile) return null;

    const router = useRouter();

    // Derive Names
    const fullName = profile.display_name || "";
    const nameParts = fullName.split(" ");
    const derivedFirstName = profile.first_name || nameParts[0] || "";
    const derivedLastName = profile.last_name || nameParts.slice(1).join(" ") || "";

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
        }

        const res = await updatePerson(payload);
        if (res.success) {
            router.refresh();
        } else {
            console.error(res.error);
            throw new Error(res.error);
        }
    };

    return (
        <div className="bg-card p-8 rounded-3xl border border-border relative overflow-hidden shadow-sm">
            {/* Background Gradient Blob */}
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-64 h-64 bg-brand-primary/20 rounded-full blur-[80px] pointer-events-none" />

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
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
                                <EditableField
                                    value={profile.display_name}
                                    onSave={(val) => handleUpdate('display_name', val)}
                                    className="hover:underline decoration-dashed underline-offset-4 decoration-primary/30"
                                    inputClassName="text-2xl font-bold bg-muted/50 border-input text-foreground rounded-lg px-2 py-1 min-w-[200px]"
                                />
                            </h1>
                            {profile.type && (
                                <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase font-bold tracking-widest text-muted-foreground border border-border">
                                    {profile.type}
                                </span>
                            )}
                            <div className="relative group flex items-center self-center">
                                {profile.custom_fields?.status ? (
                                    <StatusBadge status={profile.custom_fields.status} tenantId={tenantId} />
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-widest border border-slate-200 whitespace-nowrap">
                                        No Status
                                    </span>
                                )}
                                {/* Invisible select for editing */}
                                <select
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    value={(profile.custom_fields?.status || "").toUpperCase()}
                                    onChange={(e) => handleUpdate('status', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="" disabled>{language === 'he' ? 'שנה סטטוס' : 'Change Status'}</option>
                                    {statusOptions.map((opt: any) => {
                                        const label = opt.payload?.label_i18n?.[language] || opt.label || opt.value;
                                        return (
                                            <option key={opt.value} value={opt.value}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                        <div className="text-lg text-brand-secondary font-medium flex items-center gap-2">
                            <EditableField
                                value={profile.job_title || ""}
                                onSave={(val) => handleUpdate('role', val)}
                                placeholder="No Active Role"
                                className="hover:underline decoration-dashed"
                            />
                            {profile.employer && <span className="text-muted-foreground">at {profile.employer}</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Mail size={16} className="text-muted-foreground" />
                            <EditableField
                                value={profile.email || ""}
                                onSave={(val) => handleUpdate('email', val)}
                                type="email"
                                placeholder="No email"
                            />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Phone size={16} className="text-muted-foreground" />
                            <EditableField
                                value={profile.phone || ""}
                                onSave={(val) => handleUpdate('phone', val)}
                                type="tel"
                                placeholder="No phone"
                            />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <MapPin size={16} className="text-muted-foreground" />
                            <span>{profile.city ? `${profile.city}, ${profile.country}` : "Location unknown"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Calendar size={16} className="text-muted-foreground" />
                            <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions (Mock) */}
                <div className="flex flex-col gap-3">
                    <PersonFormDialog
                        tenantId={tenantId}
                        initialData={{
                            id: profile.id,
                            firstName: derivedFirstName,
                            lastName: derivedLastName,
                            email: profile.email,
                            phone: profile.phone,
                            // If profile has status in custom_fields, pass it here
                            status: profile.custom_fields?.status,
                            tags: profile.tags
                        }}
                    />
                    <button className="px-4 py-2 bg-secondary text-foreground border border-border font-semibold rounded-lg text-sm hover:bg-secondary/80 transition-colors">
                        Log Activity
                    </button>
                </div>
            </div>
        </div>
    );
}
