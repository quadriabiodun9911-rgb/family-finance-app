// Supabase/Postgres columns are snake_case; every TS type in this app is
// camelCase. These do a flat (one-level) conversion — none of the rows this
// app reads/writes nest objects, so a shallow pass is all that's needed.
function camelToSnakeKey(key: string): string {
    return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamelKey(key: string): string {
    return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        out[camelToSnakeKey(key)] = value;
    }
    return out;
}

export function toCamelCase<T>(obj: Record<string, unknown>): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        out[snakeToCamelKey(key)] = value;
    }
    return out as T;
}
