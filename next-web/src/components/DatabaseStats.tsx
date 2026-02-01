"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function DatabaseStats({ tenantId }: { tenantId: string }) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        if (!tenantId) return;
        const supabase = createClient();

        async function fetchCount() {
            // Using RPC for accurate, RLS-safe count
            const { data, error } = await supabase.rpc("get_people_count", {
                arg_tenant_id: tenantId,
                arg_filters: {}
            });

            if (!error && data !== null) {
                setCount(Number(data));
            }
        }

        fetchCount();

        // Optional: Subscribe to changes if we want real-time (overkill for total stats usually)
    }, [tenantId]);

    if (count === null) {
        return <span className="animate-pulse opacity-50">Loading...</span>;
    }

    return (
        <span>
            {count.toLocaleString()} Identities (Prospects & Active)
        </span>
    );
}
