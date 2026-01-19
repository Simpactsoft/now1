"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface BackButtonProps {
    fallbackUrl?: string;
    label?: string;
}

export default function BackButton({ fallbackUrl = "/dashboard/people", label = "Back" }: BackButtonProps) {
    const router = useRouter();

    const handleBack = (e: React.MouseEvent) => {
        e.preventDefault();
        // Check if there is history? (Hard to know reliably in browser, but router.back() usually works)
        // If we want to be safe, we can try router.back(), but if it fails (new tab), we might get stuck?
        // Actually, for "Back to Contacts", browser back is best IF we came from there.
        // If we deep linked, we want fallback.

        if (window.history.length > 2) {
            router.back();
        } else {
            router.push(fallbackUrl);
        }
    };

    return (
        <a
            href={fallbackUrl}
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group cursor-pointer"
        >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <ChevronLeft size={16} />
            </div>
            <span className="font-medium text-sm">{label}</span>
        </a>
    );
}
