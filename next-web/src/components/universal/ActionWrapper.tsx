"use client";

import { useTransition, useState, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

// ============================================================================
// ActionWrapper — Render-prop component for server action calls
// ============================================================================
// Wraps any server action with: loading state, inline error display,
// retry capability, success/error callbacks, and optional Sonner toasts.
//
// Usage:
// ```tsx
// <ActionWrapper
//   action={() => createPerson(data)}
//   onSuccess={(result) => router.push(`/dashboard/people/${result.id}`)}
//   successMessage="איש קשר נוצר בהצלחה"
//   errorMessage="שגיאה ביצירת איש קשר"
//   loadingText="יוצר..."
// >
//   {({ execute, isLoading }) => (
//     <Button onClick={execute} disabled={isLoading}>
//       שמור
//     </Button>
//   )}
// </ActionWrapper>
// ```
// ============================================================================

interface ActionWrapperProps<T> {
    /** The server action to invoke when execute() is called */
    action: () => Promise<ActionResult<T>>;
    /** Called with the unwrapped data on success */
    onSuccess?: (data: T) => void;
    /** Called with the error string on failure */
    onError?: (error: string) => void;
    /** Sonner toast message shown on success (omit to suppress) */
    successMessage?: string;
    /** Sonner toast message shown on error — falls back to the action's own error string */
    errorMessage?: string;
    /** Label shown in the inline spinner hint while loading */
    loadingText?: string;
    /** Render a retry button below the error message (default: true) */
    showRetry?: boolean;
    /** Render prop — receives execute, isLoading, error, and reset */
    children: (props: {
        execute: () => void;
        isLoading: boolean;
        error: string | null;
        reset: () => void;
    }) => ReactNode;
}

/**
 * Render-prop component that wraps a zero-argument server action with
 * loading state (via `useTransition`), inline error display, optional
 * retry, and Sonner toast notifications.
 *
 * The `action` prop must be a thunk — i.e. `() => myServerAction(args)`.
 * Build the thunk in the parent so that form values are captured at
 * call-site rather than inside this component.
 */
export function ActionWrapper<T>({
    action,
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    loadingText,
    showRetry = true,
    children,
}: ActionWrapperProps<T>) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Keep the latest action reference in a ref so that `retry` always calls
    // the most recent version without needing to be part of the dep array.
    const actionRef = useRef(action);
    actionRef.current = action;

    const onSuccessRef = useRef(onSuccess);
    onSuccessRef.current = onSuccess;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const run = useCallback(() => {
        setError(null);

        startTransition(async () => {
            try {
                const result = await actionRef.current();

                if (result.success) {
                    if (successMessage) {
                        toast.success(successMessage);
                    }
                    onSuccessRef.current?.(result.data);
                } else {
                    const msg = result.error;
                    setError(msg);
                    if (errorMessage || msg) {
                        toast.error(errorMessage ?? msg);
                    }
                    onErrorRef.current?.(msg);
                }
            } catch (err: any) {
                const msg: string = err?.message ?? "An unexpected error occurred";
                setError(msg);
                if (errorMessage || msg) {
                    toast.error(errorMessage ?? msg);
                }
                onErrorRef.current?.(msg);
            }
        });
    }, [successMessage, errorMessage]);

    const reset = useCallback(() => {
        setError(null);
    }, []);

    return (
        <div className="flex flex-col gap-2">
            {/* Render prop — consumer controls the trigger UI */}
            {children({
                execute: run,
                isLoading: isPending,
                error,
                reset,
            })}

            {/* Inline loading hint */}
            {isPending && loadingText && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {loadingText}
                </p>
            )}

            {/* Inline error message */}
            {error && !isPending && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        {showRetry && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={run}
                                className="h-7 shrink-0 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label="Retry"
                            >
                                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                נסה שוב
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
