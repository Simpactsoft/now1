"use client";

import { useEffect, useState, useCallback } from "react";

interface GridState {
    rowId: string | null;
    scrollTop?: number;
    searchTerm?: string;
    timestamp?: number;
    [key: string]: any;
}

export function useGridPersistence(key: string) {
    const [restoredState, setRestoredState] = useState<GridState | null>(null);

    // 1. Restore State on Mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem(key);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Optional: Expiry check (e.g. 30 mins)
                    if (Date.now() - (parsed.timestamp || 0) < 30 * 60 * 1000) {
                        setRestoredState(parsed);
                        console.log(`[${key}] Restored state:`, parsed);
                    } else {
                        sessionStorage.removeItem(key);
                    }
                }
            } catch (e) {
                console.error(`[${key}] Failed to restore state`, e);
            }
        }
    }, [key]);

    // 2. Save State Function
    const saveState = useCallback((state: Partial<GridState>) => {
        if (typeof window !== 'undefined') {
            const payload = {
                ...state,
                timestamp: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(payload));
            console.log(`[${key}] Saved state:`, payload);
        }
    }, [key]);

    // 3. Clear State Function
    const clearState = useCallback(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(key);
        }
    }, [key]);

    // 4. Scroll Restoration Helper (for HTML Tables)
    const restoreScroll = useCallback((rowId: string) => {
        // Standard DOM scroll
        setTimeout(() => {
            const element = document.getElementById(rowId);
            if (element) {
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
                element.classList.add('animate-pulse-highlight'); // Requires CSS class
                console.log(`[${key}] Scrolled to row:`, rowId);

                // Remove highlight after animation
                setTimeout(() => {
                    element.classList.remove('animate-pulse-highlight');
                }, 2000);
            } else {
                console.warn(`[${key}] Row element not found:`, rowId);
            }
        }, 100); // Slight delay for rendering
    }, [key]);

    return {
        restoredState,
        saveState,
        clearState,
        restoreScroll
    };
}
