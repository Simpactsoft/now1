import QuoteBuilder from '@/components/sales/QuoteBuilder';
import { cookies } from 'next/headers';

export const metadata = {
    title: "Quote | NOW System",
};

export default async function NewQuotePage({
    searchParams,
}: {
    searchParams: Promise<{ quoteId?: string; customerId?: string }>;
}) {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;
    const params = await searchParams;

    return (
        <div className="h-[calc(100vh-theme(spacing.16))]">
            <QuoteBuilder initialTenantId={tenantId} quoteId={params.quoteId} initialCustomerId={params.customerId} />
        </div>
    );
}
