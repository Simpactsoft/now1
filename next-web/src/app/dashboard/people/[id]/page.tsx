import { cookies } from "next/headers";
import { Suspense } from "react";
import ProfileHeader from "@/components/ProfileHeader";
import ActionTimeline from "@/components/ActionTimeline";
import { fetchPersonDetails } from "@/app/actions/fetchDetails";
import BackButton from "@/components/BackButton";
import { ChevronLeft } from "lucide-react";
import Link from "next/link"; // Kept for error state link
import { getTenantAttributes } from "@/app/actions/attributes";
import CustomFieldsCard from "@/components/people/CustomFieldsCard";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PersonProfilePage({ params }: PageProps) {
    const { id } = await params;
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '');
    console.log("PersonProfilePage tenantId:", tenantId);

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-zinc-400 font-medium">Please select a tenant to view profile</p>
            </div>
        );
    }

    const { profile, timeline, error } = await fetchPersonDetails(tenantId, id);
    const { data: attributes } = await getTenantAttributes('person');

    if (error || !profile) {
        return (
            <div className="flex flex-col gap-8">
                <Link href="/dashboard/people" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                    Back to Contacts
                </Link>
                <div className="p-8 glass rounded-3xl border border-red-500/20 text-center">
                    <h2 className="text-xl font-bold text-red-400">Profile Not Found</h2>
                    <p className="text-slate-500 mt-2">{error || "The requested person does not exist or you do not have permission."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {/* Breadcrumb / Back */}
            <div className="flex items-center gap-4">
                <BackButton label="Back to Contacts" />
            </div>

            <ProfileHeader profile={profile} tenantId={tenantId} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats / Meta */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-2xl border border-white/10">
                        <h3 className="font-bold text-white mb-4">Quick Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white/5 rounded-xl">
                                <span className="block text-xs text-slate-500 uppercase">Logins</span>
                                <span className="block text-xl font-bold text-white">24</span>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl">
                                <span className="block text-xs text-slate-500 uppercase">Risk Score</span>
                                <span className="block text-xl font-bold text-emerald-400">Low</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-2xl border border-white/10">
                        <h3 className="font-bold text-white mb-4">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {profile.tags && Object.keys(profile.tags).map(key => (
                                <span key={key} className="px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs rounded-lg font-medium border border-brand-primary/20">
                                    {key}: {profile.tags[key]}
                                </span>
                            ))}
                            {!profile.tags && <span className="text-slate-500 text-sm">No tags found</span>}
                        </div>
                    </div>

                    {/* Custom Fields (Dynamic) */}
                    {attributes && attributes.length > 0 && (
                        <CustomFieldsCard
                            attributes={attributes}
                            customFields={profile.custom_fields || {}}
                        />
                    )}
                </div>

                {/* Right Column: Timeline */}
                <div className="lg:col-span-2">
                    <ActionTimeline events={timeline} />
                </div>
            </div>
        </div>
    );
}
