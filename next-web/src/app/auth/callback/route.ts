import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const token_hash = requestUrl.searchParams.get('token_hash');
    const type = requestUrl.searchParams.get('type') as 'magiclink' | 'recovery' | 'invite' | 'email' | null;
    const next = requestUrl.searchParams.get('next') ?? '/portal/dashboard';

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    );

    // Flow 1: PKCE Code Exchange (e.g. from signInWithOAuth or older magic links)
    if (code) {
        console.log("[auth/callback] Attempting exchangeCodeForSession with code:", code);
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log("[auth/callback] exchangeCodeForSession successful. Redirecting to:", next);
            return NextResponse.redirect(`${requestUrl.origin}${next}`);
        } else {
            console.error("[auth/callback] exchangeCodeForSession failed:", error);
        }
    }

    // Flow 2: Token Hash Verification (e.g. from generateLink admin API)
    if (token_hash && type) {
        console.log(`[auth/callback] Attempting verifyOtp with token_hash: ${token_hash}, type: ${type}`);
        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        });
        if (!error) {
            console.log("[auth/callback] verifyOtp successful. Redirecting to:", next);
            return NextResponse.redirect(`${requestUrl.origin}${next}`);
        } else {
            console.error("[auth/callback] verifyOtp failed:", error);
        }
    }

    // Fallback if no valid auth method or there was an error
    console.warn(`[auth/callback] Fallback triggered. Code: ${code ? 'Yes' : 'No'}, Token: ${token_hash ? 'Yes' : 'No'}, Type: ${type}`);
    return NextResponse.redirect(`${requestUrl.origin}/portal/login?error=Invalid+magic+link`);
}
