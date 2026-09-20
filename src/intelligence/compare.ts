import { Category, Transaction } from '../types';
import { sumByType } from './cashFlow';

export interface CategoryAmount {
    categoryId: string;
    categoryName: string;
    amount: number;
}

export interface RangeSummary {
    label: string;
    startDate: string;
    endDate: string;
    income: number;
    expense: number;
    surplus: number;
    savingsRatePct: number;
    categoryTotals: CategoryAmount[]; // expense categories, largest first
}

export function computeRangeSummary(transactions: Transaction[], categories: Category[], startDate: string, endDate: string, label: string): RangeSummary {
    const inRange = transactions.filter((t) => t.date >= startDate && t.date <= endDate);
    const income = sumByType(inRange, 'income');
    const expense = sumByType(inRange, 'expense');
    const surplus = income - expense;

    const byCategory = new Map<string, number>();
    for (const t of inRange) {
        if (t.type !== 'expense') continue;
        byCategory.set(t.categoryId, (byCategory.get(t.categoryId) || 0) + t.amount);
    }
    const categoryTotals = [...byCategory.entries()]
        .map(([categoryId, amount]) => ({ categoryId, categoryName: categories.find((c) => c.id === categoryId)?.name || 'Uncategorized', amount }))
        .sort((a, b) => b.amount - a.amount);

    return { label, startDate, endDate, income, expense, surplus, savingsRatePct: income > 0 ? (surplus / income) * 100 : 0, categoryTotals };
}

export interface CategoryDelta {
    categoryName: string;
    aAmount: number;
    bAmount: number;
    deltaPct: number | null; // null when aAmount is 0 and bAmount is 0
}

export interface PeriodComparison {
    a: RangeSummary;
    b: RangeSummary;
    incomeDeltaPct: number | null;
    expenseDeltaPct: number | null;
    surplusDelta: number;
    categoryDeltas: CategoryDelta[]; // largest absolute swing first
}

// b relative to a -- a is the baseline ("before"), b is what changed ("after").
export function comparePeriods(a: RangeSummary, b: RangeSummary): PeriodComparison {
    const incomeDeltaPct = a.income > 0 ? ((b.income - a.income) / a.income) * 100 : (b.income > 0 ? 100 : null);
    const expenseDeltaPct = a.expense > 0 ? ((b.expense - a.expense) / a.expense) * 100 : (b.expense > 0 ? 100 : null);

    const names = new Set([...a.categoryTotals.map((c) => c.categoryName), ...b.categoryTotals.map((c) => c.categoryName)]);
    const categoryDeltas: CategoryDelta[] = [...names].map((name) => {
        const aAmount = a.categoryTotals.find((c) => c.categoryName === name)?.amount || 0;
        const bAmount = b.categoryTotals.find((c) => c.categoryName === name)?.amount || 0;
        const deltaPct = aAmount > 0 ? ((bAmount - aAmount) / aAmount) * 100 : (bAmount > 0 ? 100 : null);
        return { categoryName: name, aAmount, bAmount, deltaPct };
    }).sort((x, y) => Math.abs(y.bAmount - y.aAmount) - Math.abs(x.bAmount - x.aAmount));

    return { a, b, incomeDeltaPct, expenseDeltaPct, surplusDelta: b.surplus - a.surplus, categoryDeltas };
}
