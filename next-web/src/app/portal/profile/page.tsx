import { getPortalProfile } from "@/app/actions/portal-profile-actions";
import { PortalProfileForm } from "@/components/PortalProfileForm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
    const res = await getPortalProfile();

    if (!res.success) {
        // Fallback if not authenticated or not found
        redirect("/portal/login");
    }

    const profileData = res.data;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <div className="mb-6">
                <Link href="/portal/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
                <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
                <p className="text-muted-foreground mt-1">Manage your contact details and account preferences.</p>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                            {profileData.avatar_url ? (
                                <img src={profileData.avatar_url} alt="Profile" className="h-full w-full rounded-full object-cover" />
                            ) : (
                                <UserCircle size={40} className="text-indigo-400" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{profileData.display_name}</h2>
                            <p className="text-muted-foreground text-sm">{profileData.email}</p>
                        </div>
                    </div>

                    <div className="bg-muted/50 -mx-6 sm:-mx-8 px-6 sm:px-8 py-6 border-t border-border">
                        <PortalProfileForm initialData={profileData} />
                    </div>
                </div>
            </div>
        </div>
    );
}
