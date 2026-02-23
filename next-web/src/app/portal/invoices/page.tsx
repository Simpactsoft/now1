import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/app/actions/portal-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { FileDown, Clock, CheckCircle2, Receipt } from "lucide-react";

export default async function PortalInvoicesPage() {
    const supabase = await createClient();

    // 1. Authenticate user via Server Cookie or Supabase Auth
    const portalSession = await getPortalSession();
    let userEmail: string | null = null;
    let cardId: string | null = portalSession?.cardId || null;

    if (!cardId) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            redirect("/portal/login");
        }
        userEmail = user.email || null;
    }

    const adminClient = createAdminClient();
    let invoices: any[] = [];

    // 2. Fetch their mapped Card ID if we don't have it directly from the token
    if (!cardId && userEmail) {
        const { data: cards } = await adminClient.from('cards').select('id, tenant_id').eq('email', userEmail).limit(1);
        if (cards && cards.length > 0) {
            cardId = cards[0].id;
        }
    }

    if (cardId) {
        // Assuming we have an invoices table, or fetching from quotes with invoice generated
        const { data: invData } = await adminClient
            .from('invoices')
            .select('*')
            .eq('customer_id', cardId)
            .order('created_at', { ascending: false });
        invoices = invData || [];
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <div className="mb-6">
                <Link href="/portal/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Invoices & Billing</h1>
                        <p className="text-muted-foreground mt-1">Manage your payments and download past invoices.</p>
                    </div>
                </div>
            </div>

            {invoices.length === 0 ? (
                <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center text-muted-foreground">
                    <div className="flex justify-center mb-4 text-muted-foreground/30">
                        <Receipt size={48} />
                    </div>
                    <p className="text-lg font-medium text-foreground">No invoices yet.</p>
                    <p className="mt-1">When you approve a quote or get billed, your invoices will appear here.</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice #</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Download</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                        {inv.invoice_number}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {new Date(inv.due_date || inv.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-medium">
                                        {formatCurrency(inv.total_amount || 0, inv.currency || 'ILS')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            {inv.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400">
                                                    <CheckCircle2 size={12} /> Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400">
                                                    <Clock size={12} /> Pending
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 bg-background border border-border px-3 py-1.5 rounded-md hover:bg-accent transition-colors inline-flex items-center gap-2">
                                            <FileDown size={14} /> PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
