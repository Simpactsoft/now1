import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Phase 5 Middleware: Defense in Depth
 * Distinguishes between Routing Security (Middleware) and Data Security (RLS).
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Protected Route: Dashboard
    if (pathname.startsWith('/dashboard')) {
        const tenantId = request.cookies.get('tenant_id')?.value;

        // If no tenant is selected, we might want to allow the page to load 
        // but the UI will show the "Select a Tenant" state.
        // However, if we move to path-based tenancy (/app/:tenant_id/...), 
        // we would enforce a strict match here.

        // Log for debugging (production logs would be more discreet)
        console.log(`[Middleware] Path: ${pathname}, Tenant-ID from Cookie: ${tenantId || 'none'}`);

        // Optional: If we wanted to ensure the user ALWAYS has a tenant context 
        // before entering, we could redirect here.
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
