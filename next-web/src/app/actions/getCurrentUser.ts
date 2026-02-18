'use server';

import { createClient } from '@/lib/supabase/server';
import { ActionResult, actionSuccess, actionError } from '@/lib/action-result';

export async function getCurrentUser(): Promise<ActionResult<any>> {
    try {
        const supabase = await createClient();
        // Primary Check: Strict Validation (Network Call)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('[getCurrentUser] getUser failed:', {
                msg: error?.message,
                status: error?.status
            });

            // Secondary Check: Local Session Validation (Faster, reliable for pure display)
            // This mirrors how RPCs/Data Fetching might succeed even if Auth API fails
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (session?.user) {
                console.log('[getCurrentUser] Recovered via getSession(). User:', session.user.email);
                return actionSuccess(session.user);
            }

            console.error('[getCurrentUser] All Auth failed. Session Error:', sessionError?.message);
            return actionError("Not authenticated", "AUTH_ERROR");
        }

        console.log('[getCurrentUser] Success (getUser):', user.email);
        return actionSuccess(user);
    } catch (err: any) {
        console.error('[getCurrentUser] Unexpected error:', err);
        return actionError(err.message || "Unknown error");
    }
}
