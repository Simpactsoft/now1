import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalSession, portalLogoutAction } from "@/app/actions/portal-auth";
import { LogOut, FileText, Receipt, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default async function PortalDashboardPage() {
    const supabase = await createClient();

    // 1. Authenticate user via Server Cookie or Supabase Auth
    const portalSession = await getPortalSession();
    let displayEmail = "Secure Customer";

    if (!portalSession) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            redirect("/portal/login");
        }
        displayEmail = user.email || displayEmail;
    }

    // 2. We should ideally lookup their linked card_id in portal_users, 
    // but for now we'll just show the email.

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
                    <p className="text-muted-foreground mt-1">Logged in as {displayEmail}</p>
                </div>

                <form action={async () => {
                    'use server';
                    await portalLogoutAction();
                    const supabaseAsync = await createClient();
                    await supabaseAsync.auth.signOut();
                    redirect('/portal/login');
                }}>
                    <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground border border-border bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Quotes Card */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col items-center text-center hover:border-indigo-500 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <FileText size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">My Quotes</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-4">View past proposals, or approve pending quotes awaiting your signature.</p>
                    <Link href="/portal/quotes" className="mt-auto text-indigo-600 font-medium text-sm hover:underline">
                        View Quotes &rarr;
                    </Link>
                </div>

                {/* Invoices Card */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col items-center text-center hover:border-blue-500 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Receipt size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Invoices & Billing</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-4">Download your recent invoices and view your payment history.</p>
                    <Link href="/portal/invoices" className="mt-auto text-blue-600 font-medium text-sm hover:underline">
                        View Invoices &rarr;
                    </Link>
                </div>

                {/* Profile Card */}
                <div className="bg-card rounded-xl shadow-sm border border-border p-6 flex flex-col items-center text-center hover:border-emerald-500 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <LayoutDashboard size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">My Profile</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-4">View and update your personal contact details and preferences.</p>
                    <Link href="/portal/profile" className="mt-auto text-emerald-600 font-medium text-sm hover:underline">
                        Manage Profile &rarr;
                    </Link>
                </div>

            </div>
        </div>
    );
}
