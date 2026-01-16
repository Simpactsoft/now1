"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Settings,
    Database,
    Activity,
    ChevronRight,
    UserCircle,
    ChevronLeft
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { translations } from '@/lib/translations';

// We'll map keys to icons, but names will come from translation
const NAV_CONFIG = [
    { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'contacts', href: '/dashboard/people', icon: UserCircle },
    { key: 'employees', href: '/dashboard/employees', icon: Users },
    { key: 'logs', href: '/dashboard/logs', icon: Activity },
    { key: 'infrastructure', href: '/dashboard/infra', icon: Database },
    { key: 'settings', href: '/dashboard/settings', icon: Settings },
] as const;

export default function Sidebar() {
    const pathname = usePathname();
    const { t, dir } = useLanguage();

    const ChevronIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

    return (
        <div className="fixed start-0 top-0 h-full w-64 glass border-e border-white/10 flex flex-col z-50 transition-all duration-300">
            <div className="p-6">
                <h1 className="text-xl font-bold gradient-text tracking-tight flex items-center gap-2">
                    <Activity className="text-brand-primary" />
                    NOW System
                </h1>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Research Module</p>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-4">
                {NAV_CONFIG.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    const label = t(item.key as keyof typeof translations['en']);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-brand-primary/10 text-white border border-brand-primary/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={20} className={isActive ? 'text-brand-primary' : 'group-hover:text-brand-primary transition-colors'} />
                                <span className="font-medium text-sm">{label}</span>
                            </div>
                            {isActive && <ChevronIcon size={14} className="text-brand-primary" />}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto border-t border-white/10 bg-black/20 space-y-4">
                {/* Language Switcher Row */}
                <div className="flex justify-between items-center px-2">
                    <span className="text-xs text-slate-500 uppercase font-bold">Language</span>
                    <LanguageSwitcher />
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                        <UserCircle size={20} className="text-slate-400" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-white truncate">{t('admin')}</span>
                        <span className="text-xs text-slate-500 truncate">{t('instance')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
