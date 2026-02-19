import QuoteBuilder from '@/components/sales/QuoteBuilder';
import { cookies } from 'next/headers';

export const metadata = {
    title: "New Quote | NOW System",
};

export default async function NewQuotePage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;

    return (
        <div className="h-[calc(100vh-theme(spacing.16))]">
            <QuoteBuilder initialTenantId={tenantId} />
        </div>
    );
}
