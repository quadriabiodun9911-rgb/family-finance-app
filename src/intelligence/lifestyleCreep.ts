import { Insight, Transaction } from '../types';
import { shiftPeriod, currentPeriod } from '../utils/date';
import { transactionsInPeriod, sumByType } from './cashFlow';

export interface LifestyleCreepResult {
    incomeChangePct: number;
    expenseChangePct: number;
    savingsRateBefore: number;
    savingsRateNow: number;
    recentIncome: number;
    recentExpense: number;
}

// Compares the last 3 months against the 3 months before that -- income can
// be rising and still tell a bad story if spending is rising faster and
// quietly eating the savings rate. That gap is invisible in any single
// month's numbers; it only shows up by comparing the two windows.
export function computeLifestyleCreep(transactions: Transaction[]): LifestyleCreepResult | null {
    const recentPeriods = [0, 1, 2].map((n) => shiftPeriod(currentPeriod(), -n));
    const priorPeriods = [3, 4, 5].map((n) => shiftPeriod(currentPeriod(), -n));
    const sumFor = (periods: string[], type: 'income' | 'expense') =>
        periods.reduce((sum, p) => sum + sumByType(transactionsInPeriod(transactions, p), type), 0);

    const recentIncome = sumFor(recentPeriods, 'income');
    const recentExpense = sumFor(recentPeriods, 'expense');
    const priorIncome = sumFor(priorPeriods, 'income');
    const priorExpense = sumFor(priorPeriods, 'expense');
    if (priorIncome <= 0 || priorExpense <= 0 || recentIncome <= 0) return null; // not enough history yet

    return {
        incomeChangePct: ((recentIncome - priorIncome) / priorIncome) * 100,
        expenseChangePct: ((recentExpense - priorExpense) / priorExpense) * 100,
        savingsRateBefore: (priorIncome > 0 ? (priorIncome - priorExpense) / priorIncome : 0) * 100,
        savingsRateNow: (recentIncome > 0 ? (recentIncome - recentExpense) / recentIncome : 0) * 100,
        recentIncome, recentExpense,
    };
}

export function detectLifestyleCreep(transactions: Transaction[], symbol: string): Insight | null {
    const r = computeLifestyleCreep(transactions);
    if (!r) return null;

    // Only fires when spending is meaningfully outrunning income and it's
    // actually costing savings rate -- avoids noise from small month-to-month
    // swings, and a pure income drop is a different, already-covered problem.
    const savingsRateDropPts = r.savingsRateBefore - r.savingsRateNow;
    if (r.expenseChangePct - r.incomeChangePct < 8 || savingsRateDropPts < 4) return null;

    const monthlyIncomeAvg = r.recentIncome / 3;
    const projectedAnnualLoss = (savingsRateDropPts / 100) * monthlyIncomeAvg * 12;

    return {
        id: 'lifestyle-creep',
        area: 'cashflow',
        severity: r.savingsRateNow < 0 ? 'warning' : 'watch',
        title: r.incomeChangePct > 0.5 ? "You're earning more, but keeping less" : 'Spending is outpacing income',
        message: `Income is ${r.incomeChangePct >= 0 ? 'up' : 'down'} ${Math.abs(r.incomeChangePct).toFixed(0)}% over the last 3 months, but spending is ${r.expenseChangePct >= 0 ? 'up' : 'down'} ${Math.abs(r.expenseChangePct).toFixed(0)}%. Your savings rate has slipped from ${r.savingsRateBefore.toFixed(0)}% to ${r.savingsRateNow.toFixed(0)}% of income — at this pattern you could keep roughly ${symbol}${Math.round(Math.abs(projectedAnnualLoss)).toLocaleString()} less this year than if it had held steady.`,
    };
}
