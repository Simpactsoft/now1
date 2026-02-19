import { cookies } from 'next/headers';
import { QuotesListClient } from './QuotesListClient';

export const metadata = {
    title: "Quotes | NOW System",
};

export default async function QuotesPage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenant_id')?.value;

    return <QuotesListClient tenantId={tenantId} />;
}
