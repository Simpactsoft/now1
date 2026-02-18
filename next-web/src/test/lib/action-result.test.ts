import { describe, it, expect } from 'vitest'
import { actionSuccess, actionError, actionOk, type ActionResult } from '@/lib/action-result'

// ============================================================================
// TEST 5 — ActionResult Helpers
// ============================================================================

describe('ActionResult Helpers', () => {

    describe('actionSuccess', () => {
        it('should return { success: true, data }', () => {
            const result = actionSuccess({ id: '1', name: 'Test' });
            expect(result).toEqual({
                success: true,
                data: { id: '1', name: 'Test' },
            });
        });

        it('should work with primitive data types', () => {
            expect(actionSuccess(42)).toEqual({ success: true, data: 42 });
            expect(actionSuccess('hello')).toEqual({ success: true, data: 'hello' });
            expect(actionSuccess(true)).toEqual({ success: true, data: true });
        });

        it('should work with arrays', () => {
            const result = actionSuccess([1, 2, 3]);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual([1, 2, 3]);
            }
        });

        it('should have success=true for type narrowing', () => {
            const result: ActionResult<string> = actionSuccess('test');
            if (result.success) {
                // TypeScript should allow accessing result.data here
                const data: string = result.data;
                expect(data).toBe('test');
            }
        });
    });

    describe('actionError', () => {
        it('should return { success: false, error: message }', () => {
            const result = actionError('Something went wrong');
            expect(result).toEqual({
                success: false,
                error: 'Something went wrong',
            });
        });

        it('should include code when provided', () => {
            const result = actionError('Not found', 'NOT_FOUND');
            expect(result).toEqual({
                success: false,
                error: 'Not found',
                code: 'NOT_FOUND',
            });
        });

        it('should not include code when not provided', () => {
            const result = actionError('Fail');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.code).toBeUndefined();
            }
        });

        it('should work with type narrowing on error branch', () => {
            const result: ActionResult<number> = actionError('bad input', 'VALIDATION_ERROR');
            if (!result.success) {
                const error: string = result.error;
                expect(error).toBe('bad input');
                expect(result.code).toBe('VALIDATION_ERROR');
            }
        });
    });

    describe('actionOk', () => {
        it('should return { success: true, data: undefined }', () => {
            const result = actionOk();
            expect(result).toEqual({
                success: true,
                data: undefined,
            });
        });

        it('should have success=true', () => {
            const result = actionOk();
            expect(result.success).toBe(true);
        });
    });

    describe('type narrowing', () => {
        it('should narrow to success branch correctly', () => {
            const result: ActionResult<{ id: string }> = actionSuccess({ id: '123' });

            if (result.success) {
                // This should compile — data is available on success branch
                expect(result.data.id).toBe('123');
            } else {
                // This branch should not execute
                expect.unreachable('Should not reach error branch');
            }
        });

        it('should narrow to error branch correctly', () => {
            const result: ActionResult<{ id: string }> = actionError('fail');

            if (!result.success) {
                // This should compile — error is available on error branch
                expect(result.error).toBe('fail');
            } else {
                expect.unreachable('Should not reach success branch');
            }
        });
    });
});
