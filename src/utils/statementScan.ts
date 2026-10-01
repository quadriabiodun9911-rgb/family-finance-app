/**
 * Statement/receipt scanning -- lets a household member photograph or
 * upload an image (or an image-only/scanned PDF with no text layer) and
 * get back structured transaction rows, filling the gap
 * ImportStatementScreen otherwise had: its only path was a text-based CSV
 * export, with nothing for a phone photo of a till receipt or a scanned
 * bank statement.
 *
 * Calls supabase.functions.invoke('statement-scan') -- Claude reads the
 * image/PDF directly server-side (see supabase/functions/statement-scan)
 * so no separate OCR provider or API key reaches the client.
 */

import { supabase } from './supabaseClient';

export type ScannedDirection = 'income' | 'expense';

export interface ScannedTransaction {
    date:        string; // YYYY-MM-DD
    description: string;
    amount:      number;
    direction:   ScannedDirection;
}

export interface ScanResult {
    documentType:  'bank_statement' | 'receipt' | 'invoice' | 'app_screenshot' | 'unknown';
    transactions:  ScannedTransaction[];
    warning?:      string;
}

export type ScanMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

function isScannedTransaction(v: unknown): v is ScannedTransaction {
    if (!v || typeof v !== 'object') return false;
    const r = v as Record<string, unknown>;
    return typeof r.date === 'string'
        && typeof r.description === 'string'
        && typeof r.amount === 'number'
        && (r.direction === 'income' || r.direction === 'expense');
}

export async function scanStatementImage(base64: string, mediaType: ScanMediaType): Promise<ScanResult> {
    const { data, error } = await supabase.functions.invoke('statement-scan', {
        body: { base64, mediaType },
    });
    if (error) {
        // .context is only a real Response for an actual HTTP error reply;
        // a network-level failure (e.g. unreachable Supabase project) sets
        // it to something else entirely, so check for a real .json() before
        // calling it instead of throwing a confusing "not a function" error.
        const errResponse = (error as { context?: Response }).context;
        if (errResponse && typeof errResponse.json === 'function') {
            const body = await errResponse.json().catch(() => null);
            if (body?.error) throw new Error(body.error);
        }
        throw new Error(error.message || 'Could not reach the scanner.');
    }

    const rawTransactions = Array.isArray(data?.transactions) ? data.transactions : [];
    return {
        documentType: data?.documentType ?? 'unknown',
        transactions: rawTransactions.filter(isScannedTransaction),
        warning:      typeof data?.warning === 'string' ? data.warning : undefined,
    };
}
