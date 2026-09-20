import { Account, Category, Transaction } from '../types';

export interface LedgerEntry {
    transaction: Transaction;
    categoryName: string;
    accountName: string;
    debit: number; // > 0 for an expense
    credit: number; // > 0 for income
    runningBalance: number | null; // only meaningful when scoped to one account
}

export interface LedgerResult {
    entries: LedgerEntry[]; // newest first, for display
    totalDebits: number;
    totalCredits: number;
    net: number;
}

function sortKey(t: Transaction): string {
    return `${t.date}T${t.time || '00:00'}|${t.createdAt}`;
}

// A ledger's running balance only means something scoped to a single
// account. Since the app stores a live current balance rather than a
// dated opening balance, the opening balance is reconstructed by walking
// the net of all transactions back off today's balance, then forward
// again to produce each entry's running total -- standard practice for a
// system that doesn't separately book an opening balance.
export function computeLedger(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[],
    accountId: string | null,
): LedgerResult {
    const scoped = accountId ? transactions.filter((t) => t.accountId === accountId) : transactions;
    const chronological = [...scoped].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    let runningBalance: number | null = null;
    if (accountId) {
        const account = accounts.find((a) => a.id === accountId);
        const net = chronological.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
        runningBalance = (account?.balance ?? 0) - net;
    }

    const chronologicalEntries: LedgerEntry[] = chronological.map((t) => {
        if (runningBalance !== null) runningBalance += t.type === 'income' ? t.amount : -t.amount;
        return {
            transaction: t,
            categoryName: categories.find((c) => c.id === t.categoryId)?.name || 'Uncategorized',
            accountName: accounts.find((a) => a.id === t.accountId)?.name || '—',
            debit: t.type === 'expense' ? t.amount : 0,
            credit: t.type === 'income' ? t.amount : 0,
            runningBalance,
        };
    });

    const totalDebits = chronologicalEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredits = chronologicalEntries.reduce((s, e) => s + e.credit, 0);

    return { entries: [...chronologicalEntries].reverse(), totalDebits, totalCredits, net: totalCredits - totalDebits };
}
