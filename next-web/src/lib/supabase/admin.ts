import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

/**
 * createAuditAdminClient
 * Creates a service role client that bypasses RLS, but injects the current 
 * user and tenant IDs as standard HTTP headers. The Enterprise Audit Postgres 
 * triggers read these via `request.headers` to accurately log the actor.
 */
export function createAuditAdminClient(userId: string, tenantId?: string) {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            global: {
                headers: {
                    'x-audit-user-id': userId,
                    ...(tenantId ? { 'x-audit-tenant-id': tenantId } : {})
                }
            }
        }
    );
}

// Alias for consistency
export const getAdminClient = createAdminClient;
