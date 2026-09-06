import { supabase } from './supabaseClient';
import { toCamelCase, toSnakeCase } from './caseConvert';

export async function fetchAll<T>(table: string, householdId: string, orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let query = supabase.from(table).select('*').eq('household_id', householdId);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => toCamelCase<T>(row));
}

export async function insertRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.from(table).insert(toSnakeCase(row)).select().single();
    if (error) throw error;
    return toCamelCase<T>(data);
}

export async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from(table).update(toSnakeCase(patch)).eq('id', id);
    if (error) throw error;
}

export async function deleteRow(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
}
