import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/app/actions/portal-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

export default async function PortalQuotesPage() {
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
    let quotes: any[] = [];

    // 2. Fetch their mapped Card ID if we don't have it directly from the token
    if (!cardId && userEmail) {
        const { data: cards } = await adminClient.from('cards').select('id, tenant_id').eq('email', userEmail).limit(1);
        if (cards && cards.length > 0) {
            cardId = cards[0].id;
        }
    }

    if (cardId) {
        const { data: qData } = await adminClient
            .from('quotes')
            .select('*')
            .eq('customer_id', cardId)
            .order('created_at', { ascending: false });
        quotes = qData || [];
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <div className="mb-6">
                <Link href="/portal/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
                <h1 className="text-2xl font-bold text-foreground">My Quotes</h1>
                <p className="text-muted-foreground mt-1">View and approve your recent proposals.</p>
            </div>

            {quotes.length === 0 ? (
                <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center text-muted-foreground">
                    No quotes found for your account.
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quote #</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {quotes.map((quote) => (
                                <tr key={quote.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                        {quote.quote_number}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {new Date(quote.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${quote.status === 'won' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400' :
                                                quote.status === 'sent' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400' :
                                                    'bg-muted text-foreground'}`}>
                                            {quote.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right font-medium">
                                        {formatCurrency(quote.grand_total, quote.currency)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {quote.public_token ? (
                                            <Link href={`/quote/${quote.public_token}/view`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors font-medium">
                                                View Quote
                                            </Link>
                                        ) : (
                                            <span className="text-muted-foreground">Link Unavailable</span>
                                        )}
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
