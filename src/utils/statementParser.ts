import Papa from 'papaparse';
import { Category } from '../types';
import { generateId } from './id';
import { parseQuickAddText } from './quickAddParser';

function findColumn(headers: string[], patterns: RegExp[]): string | null {
    for (const h of headers) {
        if (patterns.some((p) => p.test(h))) return h;
    }
    return null;
}

function parseDateFlexible(raw: string): string {
    const trimmed = (raw || '').trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(trimmed);
    if (dmy) {
        let [, d, m, y] = dmy;
        if (y.length === 2) y = `20${y}`;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

export interface ParsedStatementRow {
    clientId: string;
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    include: boolean;
    categoryId?: string;
    categoryLabel: string;
}

export function parseStatementCsv(csvText: string, categories: Category[]): { rows: ParsedStatementRow[]; error: string | null } {
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields || [];
    if (headers.length === 0) return { rows: [], error: 'No columns found in this file — is it a CSV?' };

    const dateCol = findColumn(headers, [/date/i]);
    const descCol = findColumn(headers, [/desc/i, /narration/i, /detail/i, /particular/i, /memo/i]);
    const debitCol = findColumn(headers, [/debit/i, /withdrawal/i, /money\s*out/i]);
    const creditCol = findColumn(headers, [/credit/i, /deposit/i, /money\s*in/i]);
    const amountCol = findColumn(headers, [/^amount$/i, /^amt$/i]);

    if (!descCol && !amountCol && !debitCol && !creditCol) {
        return { rows: [], error: "Couldn't recognize this file's columns. Expected something like Date, Description, Amount." };
    }

    const rows: ParsedStatementRow[] = [];
    for (const record of parsed.data) {
        const rawDesc = descCol ? (record[descCol] || '') : Object.values(record).filter(Boolean).join(' ');
        let amount = 0;
        let type: 'income' | 'expense' = 'expense';

        if (debitCol || creditCol) {
            const debit = parseFloat((record[debitCol || ''] || '0').replace(/[,₦$£€\s]/g, ''));
            const credit = parseFloat((record[creditCol || ''] || '0').replace(/[,₦$£€\s]/g, ''));
            if (!Number.isNaN(credit) && credit > 0) { amount = credit; type = 'income'; }
            else if (!Number.isNaN(debit) && debit > 0) { amount = debit; type = 'expense'; }
            else continue;
        } else if (amountCol) {
            const raw = (record[amountCol] || '').replace(/[,₦$£€\s]/g, '');
            const value = parseFloat(raw);
            if (Number.isNaN(value) || value === 0) continue;
            amount = Math.abs(value);
            type = value < 0 ? 'expense' : 'income';
        } else {
            continue;
        }

        const date = parseDateFlexible(dateCol ? record[dateCol] : '');
        const guess = parseQuickAddText(`${type === 'income' ? 'received' : 'spent'} ${amount} ${rawDesc}`, categories);
        const categoryId = guess.ok ? guess.categoryId : undefined;
        const categoryLabel = guess.ok ? guess.categoryLabel : (type === 'income' ? 'Other Income' : 'Other');

        rows.push({
            clientId: generateId(),
            date,
            description: rawDesc.trim() || (type === 'income' ? 'Imported income' : 'Imported expense'),
            amount,
            type,
            include: true,
            categoryId,
            categoryLabel,
        });
    }

    if (rows.length === 0) return { rows: [], error: 'No transaction rows could be read from this file.' };
    return { rows, error: null };
}
