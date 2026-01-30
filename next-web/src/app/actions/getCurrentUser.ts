'use server';

import { createClient } from '@/lib/supabase/server';

export async function getCurrentUser() {
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
                return session.user;
            }

            console.error('[getCurrentUser] All Auth failed. Session Error:', sessionError?.message);
            return null;
        }

        console.log('[getCurrentUser] Success (getUser):', user.email);
        return user;
    } catch (err) {
        console.error('[getCurrentUser] Unexpected error:', err);
        return null;
    }
}
