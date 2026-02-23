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
    LogOut,
    FlaskConical,
    Building2,
    FileText,
    Plus,
    Package,
    Sliders,
    ClipboardList,
    DollarSign,
    Kanban,
    Inbox,
    CheckSquare,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { translations } from '@/lib/translations';

// We'll map keys to icons, but names will come from translation
const NAV_CONFIG = [
    { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'tasks', href: '/dashboard/tasks', icon: CheckSquare },
    { key: 'contacts', href: '/dashboard/people', icon: UserCircle },
    { key: 'organizations', href: '/dashboard/organizations', icon: Building2 },
    { key: 'products', href: '/dashboard/products', icon: Package },
    { key: 'cpq', href: '/dashboard/cpq', icon: Sliders },
    { key: 'leads', href: '/dashboard/sales/leads', icon: Inbox },
    { key: 'pipelines', href: '/dashboard/sales/pipelines', icon: Kanban },
    { key: 'quotes', href: '/dashboard/sales/quotes', icon: FileText },
    { key: 'purchase_orders', href: '/dashboard/purchase-orders', icon: ClipboardList },
    { key: 'payments', href: '/dashboard/payments', icon: DollarSign },
    { key: 'logs', href: '/dashboard/logs', icon: Activity },
    { key: 'team', href: '/dashboard/settings/team', icon: Users },
    { key: 'infrastructure', href: '/dashboard/infra', icon: Database },
    { key: 'system_admin', href: '/dashboard/admin', icon: ShieldCheck },
    { key: 'settings', href: '/dashboard/settings', icon: Settings },
] as const;

import TenantSwitcher from "./TenantSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

// ...

// Interface for Profile
export interface UserProfileData {
    name: string;
    role: string;
    email: string;
}

export default function Sidebar({
    currentTenantId,
    peopleCount = 0,
    isOpen,
    onToggle,
    isMobile,
    userProfile
}: {
    currentTenantId?: string,
    peopleCount?: number,
    isOpen: boolean,
    onToggle: () => void,
    isMobile: boolean,
    userProfile?: UserProfileData | null
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
                <div className="p-6 pb-2 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold gradient-text tracking-tight flex items-center gap-2">
                            <img src="/icon.png" alt="NOW System" className="w-7 h-7 rounded-md" />
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


                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto min-h-0 pb-2">
                    {NAV_CONFIG.filter(item => {
                        if (['infrastructure', 'system_admin'].includes(item.key)) {
                            return userProfile?.role === 'distributor';
                        }
                        // Team is generally accessible so people can manage their own org
                        return true;
                    }).map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const Icon = item.icon;
                        const label = t(item.key as keyof typeof translations['en']);
                        const showCount = item.key === 'contacts' && peopleCount > 0;

                        return (
                            <div
                                key={item.href}
                                className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 relative ${isActive
                                    ? 'bg-brand-primary/10 text-primary border border-brand-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <Link
                                    href={item.href}
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                    <Icon size={20} className={isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'} />
                                    <span className="font-medium text-sm truncate">{label}</span>
                                    {showCount && (
                                        <span className="text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded-full text-muted-foreground tabular-nums">
                                            {Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(peopleCount)}
                                        </span>
                                    )}
                                </Link>

                                <div className="flex items-center gap-2 shrink-0 z-10">
                                    {item.key === 'quotes' && (
                                        <Link
                                            href="/dashboard/sales/quotes"
                                            className="p-1 hover:bg-brand-primary/10 hover:text-brand-primary rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            title="Create New Quote"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Force reload or state reset if needed
                                            }}
                                        >
                                            <Plus size={16} />
                                        </Link>
                                    )}
                                    {isActive && item.key !== 'quotes' && <ChevronIcon size={14} className="text-brand-primary" />}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto border-t border-border bg-card/30 space-y-4 shrink-0">
                    {/* Version Display */}
                    <div className="flex justify-center mb-2">
                        <span className="text-[10px] text-muted-foreground/50 font-mono">v0.2.3</span>
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
                    <UserProfileDisplay initialProfile={userProfile} />
                </div>
            </div>
        </>
    );
}

function UserProfileDisplay({ initialProfile }: { initialProfile?: UserProfileData | null }) {
    const [profile, setProfile] = React.useState<UserProfileData | null>(initialProfile || null);
    const [error, setError] = React.useState<boolean>(false);

    // Helper to get supabase client
    const supabase = React.useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    // Sync initialProfile prop to state (in case of re-renders or hydration)
    React.useEffect(() => {
        if (initialProfile) {
            console.log('[Sidebar] Received initialProfile:', initialProfile);
            setProfile(initialProfile);
        }
    }, [initialProfile]);

    React.useEffect(() => {
        if (initialProfile) return;

        let mounted = true;

        const fetchProfile = async () => {
            try {
                const { getCurrentUser } = await import('@/app/actions/getCurrentUser');
                const userRes = await getCurrentUser();

                if (!mounted) return;

                if (!userRes.success || !userRes.data) {
                    console.warn('[Sidebar] No user session found via Server Action');
                    setProfile({ name: 'Guest', role: 'Visitor', email: '' });
                    setError(true);
                    return;
                }
                const user = userRes.data;

                // Fetch Profile details using client (since we now have a valid ID)
                // Use maybeSingle() to avoid 406 errors if 0 rows found
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!mounted) return;

                if (profileError) {
                    console.error('[Sidebar] Profile fetch error:', profileError);
                }

                if (data) {
                    setProfile({
                        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || user.email || 'User',
                        role: data.role || 'User',
                        email: user.email || ''
                    });
                } else {
                    // Fallback if no profile row exists yet
                    setProfile({
                        name: user.email?.split('@')[0] || 'User',
                        role: 'User',
                        email: user.email || ''
                    });
                }
            } catch (err) {
                console.error('[Sidebar] Unexpected error:', err);
                if (mounted) {
                    setProfile({ name: 'Error', role: 'Unknown', email: '' });
                    setError(true);
                }
            }
        };

        fetchProfile();

        return () => { mounted = false; };
    }, [supabase]);

    if (!profile) return <div className="h-12 bg-secondary/30 rounded-xl animate-pulse" />;

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 rounded-xl border border-border">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0 uppercase font-bold text-xs text-muted-foreground">
                {profile.name ? profile.name[0] : '?'}
            </div>
            <div className="flex flex-col overflow-hidden mr-auto rtl:mr-0 rtl:ml-auto min-w-0">
                <span className="text-sm font-medium text-foreground truncate" title={profile.name}>
                    {profile.name}
                    {error && <span className="text-[9px] text-destructive ml-1">(Auth Err)</span>}
                </span>
                <span className="text-[10px] text-muted-foreground truncate uppercase">{profile.role}</span>
            </div>
            <button
                onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/login';
                }}
                className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-lg transition-colors shrink-0"
                title="Log Out"
            >
                <LogOut size={16} />
            </button>
        </div>
    );
}

