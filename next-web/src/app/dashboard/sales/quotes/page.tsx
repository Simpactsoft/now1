import QuoteBuilder from '@/components/sales/QuoteBuilder';
import { cookies } from 'next/headers';

export default async function QuotesPage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;

    return (
        <div className="h-[calc(100vh-theme(spacing.16))]">
            <QuoteBuilder initialTenantId={tenantId} />
        </div>
    );
}
