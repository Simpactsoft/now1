import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTenantId } from '@/lib/auth/tenant'
import type { User, SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TEST 3 — Tenant Isolation
// ============================================================================

describe('Tenant Isolation', () => {

    describe('getTenantId', () => {
        it('should return tenant_id from app_metadata', async () => {
            const user = {
                id: 'user-1',
                app_metadata: { tenant_id: 'tenant-from-app-meta' },
                user_metadata: {},
            } as unknown as User;

            const supabase = {} as SupabaseClient; // Won't be called

            const result = await getTenantId(user, supabase);
            expect(result).toBe('tenant-from-app-meta');
        });

        it('should return tenant_id from user_metadata when app_metadata is empty', async () => {
            const user = {
                id: 'user-1',
                app_metadata: {},
                user_metadata: { tenant_id: 'tenant-from-user-meta' },
            } as unknown as User;

            const supabase = {} as SupabaseClient;

            const result = await getTenantId(user, supabase);
            expect(result).toBe('tenant-from-user-meta');
        });

        it('should fall back to profiles table when metadata has no tenant_id', async () => {
            const user = {
                id: 'user-1',
                app_metadata: {},
                user_metadata: {},
            } as unknown as User;

            const mockSingle = vi.fn().mockResolvedValue({
                data: { tenant_id: 'tenant-from-profiles' },
                error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

            const supabase = { from: mockFrom } as unknown as SupabaseClient;

            const result = await getTenantId(user, supabase);
            expect(result).toBe('tenant-from-profiles');
            // Verify the correct table and column were queried
            expect(mockFrom).toHaveBeenCalledWith('profiles');
            expect(mockSelect).toHaveBeenCalledWith('tenant_id');
            expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
        });

        it('should return null when no tenant_id is found anywhere', async () => {
            const user = {
                id: 'user-1',
                app_metadata: {},
                user_metadata: {},
            } as unknown as User;

            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
            });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

            const supabase = { from: mockFrom } as unknown as SupabaseClient;

            const result = await getTenantId(user, supabase);
            expect(result).toBeNull();
        });

        it('should prioritize app_metadata over user_metadata', async () => {
            const user = {
                id: 'user-1',
                app_metadata: { tenant_id: 'app-tenant' },
                user_metadata: { tenant_id: 'user-tenant' },
            } as unknown as User;

            const supabase = {} as SupabaseClient;

            const result = await getTenantId(user, supabase);
            // app_metadata.tenant_id ?? user_metadata.tenant_id — app takes priority
            expect(result).toBe('app-tenant');
        });
    });
});
