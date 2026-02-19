'use server';

import { cookies } from 'next/headers';
import ApprovalQueue from '@/components/approvals/ApprovalQueue';

export default async function ApprovalsPage() {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get('tenantId')?.value;

    if (!tenantId) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tenant selected</p>
            </div>
        );
    }

    return <ApprovalQueue tenantId={tenantId} />;
}
