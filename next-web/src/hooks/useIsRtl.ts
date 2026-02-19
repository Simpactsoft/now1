"use client";

import { useState, useEffect } from "react";

/**
 * Detects RTL mode from the document's dir attribute.
 * Reads the dir set on <html> by the root layout.
 */
export function useIsRtl(): boolean {
    const [isRtl, setIsRtl] = useState(false);

    useEffect(() => {
        const dir = document.documentElement.getAttribute("dir");
        setIsRtl(dir === "rtl");

        // Watch for dynamic changes
        const observer = new MutationObserver(() => {
            const currentDir = document.documentElement.getAttribute("dir");
            setIsRtl(currentDir === "rtl");
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["dir"],
        });

        return () => observer.disconnect();
    }, []);

    return isRtl;
}
