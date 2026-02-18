// ============================================================================
// ActionResult<T> — Unified return type for all server actions
// ============================================================================

/**
 * Standard return type for server actions that mutate data.
 * 
 * Usage:
 * ```typescript
 * export async function createItem(input: ItemInput): Promise<ActionResult<Item>> {
 *     // validation...
 *     return actionSuccess(item);
 *     // or
 *     return actionError("Not found", "NOT_FOUND");
 * }
 * ```
 */
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string; code?: string };

/**
 * Standard return type for server actions that fetch grid/list data.
 * Used by AG Grid and entity views.
 */
export type GridResult<T> = {
    rowData: T[];
    rowCount: number;
    error?: string;
    latency?: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Create a successful ActionResult */
export function actionSuccess<T>(data: T): ActionResult<T> {
    return { success: true, data };
}

/** Create a failed ActionResult */
export function actionError(error: string, code?: string): ActionResult<never> {
    return { success: false, error, code };
}

/** Create a successful void ActionResult (for delete/update operations) */
export function actionOk(): ActionResult<void> {
    return { success: true, data: undefined };
}
