"use client";

import React, { createContext, useContext, ReactNode } from "react";

// Define the shape of our Session
interface UserSession {
    name: string;
    email: string;
    role: string;
}

interface SessionContextType {
    user: UserSession | null;
    isLoading: boolean;
}

const SessionContext = createContext<SessionContextType>({
    user: null,
    isLoading: true,
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({
    user,
    children
}: {
    user: UserSession | null;
    children: ReactNode
}) {
    // In this simple version, we pass the user directly from server props (RootLayout)
    // to the context, avoiding client-side fetch flicker.
    return (
        <SessionContext.Provider value={{ user, isLoading: false }}>
            {children}
        </SessionContext.Provider>
    );
}

// Helper hook for permissions (Frontend Logic matching Backend)
export function usePermission(permission: string) {
    const { user } = useSession();

    // Fallback: If no user, no permission
    if (!user) return false;

    // Admin (Distributor) has all permissions
    if (user.role === 'distributor') return true;

    // Dealer Restrictions (Mirroring DB Logic roughly)
    // Ideally we would fetch exact permissions from DB, but for UI hiding,
    // a simplified logic mapping is effectively standard for responsiveness.
    if (user.role === 'dealer' || user.role === 'agent') {
        if (permission === 'contacts.delete') return false;
        if (permission === 'export.data') return false;
        return true;
    }

    return false;
}
