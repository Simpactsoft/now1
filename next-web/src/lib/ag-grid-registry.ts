"use client";

// AG Grid v35 uses the built-in Theming API — no legacy CSS imports needed

import { ModuleRegistry } from "ag-grid-community";
import { AllEnterpriseModule, LicenseManager } from "ag-grid-enterprise";

// Note: If you have a license key, uncomment and set it here
// LicenseManager.setLicenseKey('YOUR_KEY');

ModuleRegistry.registerModules([AllEnterpriseModule]);



// Silence the noisy AG Grid Enterprise trial warnings that trigger "Error" overlays
if (typeof window !== "undefined") {
    const originalError = console.error;
    console.error = (...args) => {
        const firstArg = args[0];
        if (typeof firstArg === "string" && (
            firstArg.includes("AG Grid Enterprise") ||
            firstArg.includes("License Key") ||
            firstArg.includes("license key") ||
            /^\*+$/.test(firstArg.trim())
        )) {
            return;
        }
        originalError.apply(console, args);
    };

    const originalWarn = console.warn;
    console.warn = (...args) => {
        const firstArg = args[0];
        if (typeof firstArg === "string" && (
            firstArg.includes("AG Grid Enterprise") ||
            firstArg.includes("License Key") ||
            /^\*+$/.test(firstArg.trim())
        )) {
            return;
        }
        originalWarn.apply(console, args);
    };

}

export default function AgGridRegistry() {
    return null;
}
