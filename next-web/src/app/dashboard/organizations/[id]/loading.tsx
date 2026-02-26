import { Loader2 } from "lucide-react";

export default function LoadingOrganizationProfile() {
    return (
        <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                <p className="font-medium animate-pulse">טוען פרופיל ארגון...</p>
            </div>
        </div>
    );
}
