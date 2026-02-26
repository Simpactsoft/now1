
import { cookies } from "next/headers";
import OrganizationHeader from "@/components/OrganizationHeader";
import RelationshipManager from "@/components/RelationshipManager";
import ActionTimeline from "@/components/ActionTimeline";
import { fetchOrganizationDetails } from "@/app/actions/fetchDetails";
import BackButton from "@/components/BackButton";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerQuotes } from "@/components/CustomerQuotes";
import { TimelineFeed } from "@/components/timeline/TimelineFeed";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function OrganizationProfilePage({ params }: PageProps) {
    const { id } = await params;
    const cookieStore = await cookies();
    const rawTenantId = cookieStore.get("tenant_id")?.value;
    const tenantId = rawTenantId?.replace(/['"]+/g, '');

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-zinc-400 font-medium">Please select a tenant to view organization</p>
            </div>
        );
    }

    const orgRes = await fetchOrganizationDetails(tenantId, id);

    if (!orgRes.success || !orgRes.data?.profile) {
        return (
            <div className="flex flex-col gap-8">
                <Link href="/dashboard/organizations" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                    Back to Organizations
                </Link>
                <div className="p-8 bg-card rounded-3xl border border-destructive/20 text-center">
                    <h2 className="text-xl font-bold text-destructive">Organization Not Found</h2>
                    <p className="text-muted-foreground mt-2">{!orgRes.success ? orgRes.error : "The requested organization does not exist."}</p>
                </div>
            </div>
        );
    }

    const { profile, timeline } = orgRes.data;

    return (
        <div className="flex flex-col gap-8 p-6 md:p-8">
            {/* Breadcrumb / Back */}
            <div className="flex items-center gap-4">
                <BackButton label="Back to Organizations" />
            </div>

            <OrganizationHeader profile={profile} tenantId={tenantId} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats / Meta */}
                <div className="space-y-6">
                    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
                        <h3 className="font-bold text-foreground mb-3">Quick Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/50 rounded-xl border border-border/50">
                                <span className="block text-xs text-muted-foreground uppercase">Revenue</span>
                                <span className="block text-xl font-bold text-foreground">-</span>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-xl border border-border/50">
                                <span className="block text-xs text-muted-foreground uppercase">Headcount</span>
                                <span className="block text-xl font-bold text-foreground">{profile.size || "-"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
                        <h3 className="font-bold text-foreground mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {/* Tags are currently stored as array of strings in profile.tags */}
                            {profile.tags && Array.isArray(profile.tags) && profile.tags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded-lg font-medium border border-brand-primary/20">
                                    {tag}
                                </span>
                            ))}
                            {(!profile.tags || profile.tags.length === 0) && <span className="text-muted-foreground text-sm">No tags found</span>}
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline & Relationships */}
                <div className="lg:col-span-2 space-y-8">
                    <Tabs defaultValue="stream" className="w-full">
                        <TabsList className="w-full grid grid-cols-3 mb-6">
                            <TabsTrigger value="stream" className="text-base font-medium">זרם פעילויות (חדש)</TabsTrigger>
                            <TabsTrigger value="relationships" className="text-base font-medium">קשרים</TabsTrigger>
                            <TabsTrigger value="quotes" className="text-base font-medium">הצעות מחיר</TabsTrigger>
                        </TabsList>

                        <TabsContent value="relationships" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <RelationshipManager
                                tenantId={tenantId}
                                entityId={id}
                                entityType="organization"
                            />
                        </TabsContent>

                        <TabsContent value="stream" className="mt-0 focus-visible:outline-none focus-visible:ring-0 space-y-8">
                            <ActionTimeline events={timeline} />

                            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                                <TimelineFeed entityId={id} />
                            </div>
                        </TabsContent>

                        <TabsContent value="quotes" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            <CustomerQuotes tenantId={tenantId} customerId={id} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
