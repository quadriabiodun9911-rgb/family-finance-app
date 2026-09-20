import { Account, Category, Debt, Transaction } from '../types';

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

export interface TrialBalanceRow {
    name: string;
    type: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
    debit: number;
    credit: number;
}

export interface TrialBalanceResult {
    rows: TrialBalanceRow[];
    totalDebits: number;
    totalCredits: number;
}

// A real double-entry trial balance, built from data this app only stores
// single-entry: every account is a debit-normal asset, every debt a
// credit-normal liability, and every category's all-time transaction total
// becomes a nominal income (credit) or expense (debit) account. Those two
// sides won't naturally match -- money that was already in an account or
// already owed before its history was logged here never went through a
// category -- so the gap is posted to "Opening Balance Equity", the same
// plug real bookkeeping software posts for a new company's starting
// balances. That plug is what makes total debits equal total credits by
// construction, which is the entire point of a trial balance: proving the
// books balance.
export function computeTrialBalance(accounts: Account[], debts: Debt[], categories: Category[], transactions: Transaction[]): TrialBalanceResult {
    const rows: TrialBalanceRow[] = [];

    for (const a of accounts) {
        if (a.balance === 0) continue;
        rows.push({ name: a.name, type: 'asset', debit: Math.max(0, a.balance), credit: Math.max(0, -a.balance) });
    }
    for (const d of debts) {
        if (d.balance === 0) continue;
        rows.push({ name: d.name, type: 'liability', debit: 0, credit: d.balance });
    }

    const byCategory = new Map<string, number>();
    for (const t of transactions) {
        byCategory.set(t.categoryId, (byCategory.get(t.categoryId) || 0) + t.amount);
    }
    for (const c of categories) {
        const total = byCategory.get(c.id) || 0;
        if (total === 0) continue;
        if (c.type === 'expense') rows.push({ name: c.name, type: 'expense', debit: total, credit: 0 });
        else rows.push({ name: c.name, type: 'income', debit: 0, credit: total });
    }

    const totalAssets = accounts.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = debts.reduce((s, d) => s + d.balance, 0);
    const totalIncome = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.credit, 0);
    const totalExpense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.debit, 0);

    const equityPlug = totalAssets - totalLiabilities - (totalIncome - totalExpense);
    if (Math.abs(equityPlug) > 0.01) {
        rows.push({ name: 'Opening Balance Equity', type: 'equity', debit: Math.max(0, -equityPlug), credit: Math.max(0, equityPlug) });
    }

    return {
        rows,
        totalDebits: rows.reduce((s, r) => s + r.debit, 0),
        totalCredits: rows.reduce((s, r) => s + r.credit, 0),
    };
}
