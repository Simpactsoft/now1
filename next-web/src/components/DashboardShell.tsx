"use client";

import React, { useState, useEffect } from "react";
import Sidebar, { UserProfileData } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
    children: React.ReactNode;
    currentTenantId?: string;
    peopleCount: number;
    userProfile?: UserProfileData | null;
}

export default function DashboardShell({
    children,
    currentTenantId,
    peopleCount,
    userProfile
}: DashboardShellProps) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Bypass DashboardShell entirely for login or public quote pages
    const isPublicRoute = pathname?.startsWith('/login') || pathname?.startsWith('/quote');
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Initial check for screen size & Auto-Heal Tenant
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobile(mobile);
            if (mobile) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };

        checkMobile();

        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
        };

        window.addEventListener("resize", handleResize);

        // [Auto-Heal] Validate Tenant ID
        const validateTenant = async () => {
            // Dynamically import to avoid server-side issues in client component if needed, 
            // but standard import work for Server Actions.
            const { fetchUserTenants } = await import("@/app/actions/fetchUserTenants");
            const { setTenantAction } = await import("@/app/actions/setTenant");

            try {
                const { tenants } = await fetchUserTenants();
                if (tenants && tenants.length > 0) {
                    const validIds = tenants.map((t: any) => t.id);

                    // If current cookie is missing OR is NOT in the user's valid list
                    // (e.g. Stale Admin Cookie)
                    if (!currentTenantId || !validIds.includes(currentTenantId)) {
                        console.log("[DashboardShell] Fix: Tenant Mismatch detected.", { current: currentTenantId, valid: validIds });
                        console.log("[DashboardShell] Auto-switching to:", tenants[0].id);

                        await setTenantAction(tenants[0].id);

                        // Force hard reload to pick up new cookie in Server Components
                        window.location.reload();
                    }
                }
            } catch (e) {
                console.error("[DashboardShell] Tenant Validation Failed", e);
            }
        };

        // Short delay to allow hydration
        setTimeout(validateTenant, 1000);

        return () => window.removeEventListener("resize", handleResize);
    }, [currentTenantId]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
            <Sidebar
                currentTenantId={currentTenantId}
                peopleCount={peopleCount}
                isOpen={isSidebarOpen}
                onToggle={toggleSidebar}
                isMobile={isMobile}
                userProfile={userProfile}
            />

            {/* Main Content Area */}
            {/* 
                Desktop: 
                - If Open: ms-64 (256px) 
                - If Closed: ms-0
                Mobile:
                - Always ms-0 (Sidebar is fixed overlay)
            */}
            <main
                className={`
                    flex-1 p-8 relative overflow-hidden transition-all duration-300 ease-in-out
                    ${!isMobile && isSidebarOpen ? 'ms-64' : 'ms-0'}
                `}
            >
                {/* Background blobs */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-brand-secondary/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10">
                    {children}
                </div>
            </main>

            {/* Mobile Backdrop */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
