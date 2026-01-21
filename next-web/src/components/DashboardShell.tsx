"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface DashboardShellProps {
    children: React.ReactNode;
    currentTenantId?: string;
    peopleCount: number;
}

export default function DashboardShell({
    children,
    currentTenantId,
    peopleCount,
}: DashboardShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Initial check for screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobile(mobile);
            // If we switch to mobile, default to closed. If desktop, default to open.
            // Only set this on initial load or drastic resize? 
            // Better: Just track isMobile to know behavior, but let user toggle.
            // On mount:
            if (mobile) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };

        checkMobile();

        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            // Optional: Auto-close on resize to mobile? Auto-open on resize to desktop?
            // For now, let's keep it simple.
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
            <Sidebar
                currentTenantId={currentTenantId}
                peopleCount={peopleCount}
                isOpen={isSidebarOpen}
                onToggle={toggleSidebar}
                isMobile={isMobile}
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
