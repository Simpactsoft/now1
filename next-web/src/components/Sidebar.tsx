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
    ChevronLeft,
    ShieldCheck,
    Menu,
    X,
    LogOut
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
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
    { key: 'system_admin', href: '/dashboard/admin', icon: ShieldCheck },
    { key: 'settings', href: '/dashboard/settings', icon: Settings },
] as const;

import TenantSwitcher from "./TenantSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

// ...

export default function Sidebar({
    currentTenantId,
    peopleCount = 0,
    isOpen,
    onToggle,
    isMobile
}: {
    currentTenantId?: string,
    peopleCount?: number,
    isOpen: boolean,
    onToggle: () => void,
    isMobile: boolean
}) {
    const pathname = usePathname();
    const { t, dir } = useLanguage();

    // Close mobile menu on route change
    React.useEffect(() => {
        if (isMobile && isOpen) {
            onToggle();
        }
    }, [pathname]);

    const ChevronIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

    return (
        <>
            {/* Toggle Button (Always visible logic) */}
            {/* 
               Scenario 1: Desktop, Closed -> Need button to Open. 
               Scenario 2: Mobile, Closed -> Need button to Open.
               Scenario 3: Desktop, Open -> Maybe hide button? Or show "Close" button?
               Scenario 4: Mobile, Open -> Button is usually inside sidebar to close, or backdrop closes it.
            */}

            {/* Floating Toggle Button - Shows when sidebar is CLOSED or MOBILE */}
            {/* Floating Toggle Button - Only show when sidebar is CLOSED */}
            {!isOpen && (
                <button
                    onClick={onToggle}
                    className="fixed top-3 ltr:left-4 rtl:right-4 z-[200] p-2 text-muted-foreground hover:text-primary hover:bg-secondary/50 rounded-lg transition-all"
                    aria-label="Open Menu"
                >
                    <Menu size={24} strokeWidth={2} />
                </button>
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed start-0 top-0 h-full w-64 glass border-e border-border flex flex-col z-50 
                transition-transform duration-300 ease-in-out bg-background/95 lg:bg-background/80
                ${isOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}
            `}>
                <div className="p-6 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold gradient-text tracking-tight flex items-center gap-2">
                            <Activity className="text-brand-primary" />
                            NOW System
                        </h1>

                        {/* Close Button Inside Sidebar - Always show now to allow closing on Desktop too */}
                        <button
                            onClick={onToggle}
                            className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors"
                            aria-label="Close Sidebar"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Active Tenant Display */}
                    <div className="mb-2">
                        <TenantSwitcher currentTenantId={currentTenantId} />
                    </div>

                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-4">Research Module</p>
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4">
                    {NAV_CONFIG.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const Icon = item.icon;
                        const label = t(item.key as keyof typeof translations['en']);
                        const showCount = item.key === 'contacts' && peopleCount > 0;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-brand-primary/10 text-primary border border-brand-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={20} className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'} />
                                    <span className="font-medium text-sm">{label}</span>
                                    {showCount && (
                                        <span className="text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded-full text-muted-foreground tabular-nums">
                                            {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(peopleCount)}
                                        </span>
                                    )}
                                </div>
                                {isActive && <ChevronIcon size={14} className="text-brand-primary" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto border-t border-border bg-card/30 space-y-4">
                    {/* Version Display */}
                    <div className="flex justify-center mb-2">
                        <span className="text-[10px] text-muted-foreground/50 font-mono">v0.2.2</span>
                    </div>

                    {/* Theme Switcher Row */}
                    <div className="flex justify-between items-center px-2">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Theme</span>
                        <ThemeSwitcher />
                    </div>

                    {/* Language Switcher Row */}
                    <div className="flex justify-between items-center px-2">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Language</span>
                        <LanguageSwitcher />
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 rounded-xl border border-border">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0">
                            <UserCircle size={20} className="text-muted-foreground" />
                        </div>
                        <div className="flex flex-col overflow-hidden mr-auto rtl:mr-0 rtl:ml-auto">
                            <span className="text-sm font-medium text-foreground truncate">{t('admin')}</span>
                            <span className="text-xs text-muted-foreground truncate">{t('instance')}</span>
                        </div>
                        <button
                            onClick={async () => {
                                const supabase = createBrowserClient(
                                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                                );
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-lg transition-colors"
                            title="Log Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
