import { createClient } from "@/lib/supabase/server";

export interface FieldPermission {
    column_name: string;
    can_read: boolean;
    can_write: boolean;
    restricted_values: string[] | null;
}

/**
 * enforceFLSRead
 * 
 * Takes a data payload from the database and scrubs fields that the
 * current user's role is not allowed to read.
 * 
 * @param tableName The name of the table the data is from
 * @param role The role of the current user
 * @param data The data object or array of objects to scrub
 * @returns The scrubbed data and a list of fields that were removed
 */
export async function enforceFLSRead<T extends Record<string, any>>(
    tableName: string,
    role: string,
    data: T | T[]
): Promise<{ safeData: Partial<T> | Partial<T>[], removedFields: string[] }> {
    const supabase = await createClient();

    // Fetch permissions for this role and table
    const { data: permissions, error } = await supabase
        .from('field_permissions')
        .select('column_name, can_read')
        .eq('role', role)
        .eq('table_name', tableName);

    if (error || !permissions || permissions.length === 0) {
        // Option: Fail closed (remove everything) or fail open (allow all)?
        // Secure design: If no FLS records exist, assume NO RESTRICTIONS are applied yet,
        // or FAIL CLOSED. Given it's a new feature, we default to returning data as-is 
        // if no FLS policy exists for the table/role, to prevent breaking the app.
        return { safeData: data, removedFields: [] };
    }

    const unreadableFields = permissions
        .filter((p) => p.can_read === false)
        .map((p) => p.column_name);

    if (unreadableFields.length === 0) {
        return { safeData: data, removedFields: [] };
    }

    const scrub = (obj: T): Partial<T> => {
        const result = { ...obj };
        for (const field of unreadableFields) {
            if (field in result) {
                delete result[field];
            }
        }
        return result;
    };

    if (Array.isArray(data)) {
        return { safeData: data.map(scrub), removedFields: unreadableFields };
    }

    return { safeData: scrub(data), removedFields: unreadableFields };
}

/**
 * enforceFLSWrite
 * 
 * Validates an incoming data payload against FLS write permissions.
 * Throws an error if the user is trying to write to a protected field
 * or trying to set a restricted value.
 * 
 * @param tableName The table being written to 
 * @param role User role
 * @param data The payload intended for insert/update
 */
export async function enforceFLSWrite(
    tableName: string,
    role: string,
    data: Record<string, any>
): Promise<void> {
    const supabase = await createClient();

    const { data: permissions, error } = await supabase
        .from('field_permissions')
        .select('column_name, can_write, restricted_values')
        .eq('role', role)
        .eq('table_name', tableName);

    if (error || !permissions) return;

    for (const p of permissions) {
        const incomingValue = data[p.column_name];

        // If the payload includes a field they have explicitly been denied write access to
        if (incomingValue !== undefined && p.can_write === false) {
            throw new Error(`FLS Violation: Role '${role}' is not permitted to write to field '${p.column_name}'.`);
        }

        // If the field has restricted allowed values (e.g. they can set status 'pending' but not 'approved')
        if (incomingValue !== undefined && p.restricted_values && Array.isArray(p.restricted_values)) {
            if (!p.restricted_values.includes(incomingValue.toString())) {
                throw new Error(`FLS Violation: Role '${role}' cannot set '${p.column_name}' to '${incomingValue}'. Allowed values are: ${p.restricted_values.join(', ')}.`);
            }
        }
    }
}
