"use client";

import { useState, useCallback, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";

// ============================================================================
// useAction Hook — Standard wrapper for server action calls
// ============================================================================
// Provides: loading state, error handling, retry, and automatic state management
//
// Usage:
// ```tsx
// const { execute, loading, error, data, retry } = useAction(createTemplate);
//
// const handleSubmit = async (input: TemplateInput) => {
//     const result = await execute(input);
//     if (result.success) {
//         router.push(`/dashboard/cpq/${result.data.id}`);
//     }
// };
// ```
// ============================================================================

interface UseActionOptions<T> {
    /** Called on successful execution */
    onSuccess?: (data: T) => void;
    /** Called on failed execution */
    onError?: (error: string, code?: string) => void;
    /** Reset data on new execution (default: true) */
    resetOnExecute?: boolean;
}

interface UseActionReturn<TInput, TOutput> {
    /** Execute the action with the given input */
    execute: (...args: TInput extends void ? [] : [TInput]) => Promise<ActionResult<TOutput>>;
    /** Whether the action is currently executing */
    loading: boolean;
    /** Error message from the last execution (null if success) */
    error: string | null;
    /** Error code from the last execution */
    errorCode: string | null;
    /** Data from the last successful execution */
    data: TOutput | null;
    /** Retry the last execution with the same input */
    retry: () => Promise<ActionResult<TOutput> | null>;
    /** Reset all state */
    reset: () => void;
}

/**
 * Hook that wraps a server action with loading, error, and retry state.
 * 
 * Callbacks (onSuccess, onError) are stored in refs to avoid recreating
 * the execute function when consumers pass inline callbacks.
 * 
 * @param action - The server action function to wrap
 * @param options - Optional callbacks and configuration
 */
export function useAction<TInput = void, TOutput = void>(
    action: (...args: any[]) => Promise<ActionResult<TOutput>>,
    options: UseActionOptions<TOutput> = {}
): UseActionReturn<TInput, TOutput> {
    const { resetOnExecute = true } = options;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [data, setData] = useState<TOutput | null>(null);
    const lastArgsRef = useRef<any[]>([]);

    // Store callbacks and action in refs to prevent stale closures
    const actionRef = useRef(action);
    actionRef.current = action;
    const onSuccessRef = useRef(options.onSuccess);
    onSuccessRef.current = options.onSuccess;
    const onErrorRef = useRef(options.onError);
    onErrorRef.current = options.onError;

    const execute = useCallback(
        async (...args: any[]): Promise<ActionResult<TOutput>> => {
            lastArgsRef.current = args;
            setLoading(true);
            setError(null);
            setErrorCode(null);
            if (resetOnExecute) setData(null);

            try {
                const result = await actionRef.current(...args);

                if (result.success) {
                    setData(result.data);
                    onSuccessRef.current?.(result.data);
                } else {
                    setError(result.error);
                    setErrorCode(result.code ?? null);
                    onErrorRef.current?.(result.error, result.code);
                }

                return result;
            } catch (err: any) {
                const errorMsg = err?.message || "An unexpected error occurred";
                setError(errorMsg);
                onErrorRef.current?.(errorMsg);
                return { success: false, error: errorMsg };
            } finally {
                setLoading(false);
            }
        },
        [resetOnExecute]
    );

    const retry = useCallback(async (): Promise<ActionResult<TOutput> | null> => {
        if (lastArgsRef.current.length === 0 && !actionRef.current.length) {
            return execute();
        }
        if (lastArgsRef.current.length > 0) {
            return execute(...lastArgsRef.current);
        }
        return null;
    }, [execute]);

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setErrorCode(null);
        setData(null);
        lastArgsRef.current = [];
    }, []);

    return {
        execute: execute as any,
        loading,
        error,
        errorCode,
        data,
        retry,
        reset,
    };
}
