import React from 'react';
import { Mail, Phone, MapPin, Building, Calendar, User } from 'lucide-react';

interface ProfileHeaderProps {
    profile: any;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
    if (!profile) return null;

    return (
        <div className="glass p-8 rounded-3xl border border-white/10 relative overflow-hidden">
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
                            <h1 className="text-3xl font-bold text-white tracking-tight">{profile.display_name}</h1>
                            {profile.type && (
                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase font-bold tracking-widest text-slate-300 border border-white/5">
                                    {profile.type}
                                </span>
                            )}
                        </div>
                        <p className="text-lg text-brand-secondary font-medium flex items-center gap-2">
                            {profile.job_title || "No Active Role"}
                            {profile.employer && <span className="text-slate-500">at {profile.employer}</span>}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <Mail size={16} className="text-slate-500" />
                            <span>{profile.email || "No email provided"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <Phone size={16} className="text-slate-500" />
                            <span>{profile.phone || "No phone provided"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <MapPin size={16} className="text-slate-500" />
                            <span>{profile.city ? `${profile.city}, ${profile.country}` : "Location unknown"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <Calendar size={16} className="text-slate-500" />
                            <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions (Mock) */}
                <div className="flex flex-col gap-3">
                    <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-slate-200 transition-colors">
                        Edit Profile
                    </button>
                    <button className="px-4 py-2 bg-white/5 text-white border border-white/10 font-semibold rounded-lg text-sm hover:bg-white/10 transition-colors">
                        Log Activity
                    </button>
                </div>
            </div>
        </div>
    );
}
