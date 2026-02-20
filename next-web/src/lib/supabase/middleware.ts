import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let initialResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    initialResponse = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        initialResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    // This triggers the session refresh mechanism.
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // DEBUG: Log cookies to understand why user is null
    const cookieNames = request.cookies.getAll().map(c => c.name).join(', ');
    console.log(`Middleware [${request.method} ${request.nextUrl.pathname}]: User=${user?.id ? 'Yes' : 'No'}, Cookies=[${cookieNames}]`);

    const isServerAction = request.headers.get('next-action');
    const isApi = request.nextUrl.pathname.startsWith('/api');

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/quote') &&
        !isServerAction && // Do not redirect Server Actions (let them fail gracefully with JSON)
        !isApi
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return initialResponse
}
