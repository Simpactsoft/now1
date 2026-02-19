// ============================================================================
// SHARED TYPES & UTILITIES (non-server-action file)
// ============================================================================
// This file exists separately from auth.ts because auth.ts is a 'use server'
// file, and Next.js requires ALL exports from 'use server' files to be async.
// isAuthError() is a synchronous type guard, so it lives here.
// ============================================================================

export interface ActionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface AuthContext {
    userId: string;
    tenantId?: string;
}

/**
 * Type guard: checks if auth result is an error.
 */
export function isAuthError(
    auth: AuthContext | { error: string }
): auth is { error: string } {
    return 'error' in auth;
}
