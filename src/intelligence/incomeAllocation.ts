import { Category, Transaction } from '../types';
import { transactionsInPeriod } from './cashFlow';

export type JarKey = 'expenses' | 'savings' | 'emergency';

export const JAR_LABELS: Record<JarKey, string> = {
    expenses: 'Expenses',
    savings: 'Savings & Investment',
    emergency: 'Emergency',
};

export function categoryJar(category: Category): JarKey {
    return category.jar || 'expenses';
}

export interface JarActuals {
    expenses: number;
    savings: number;
    emergency: number;
}

// What actually happened this period, per jar -- every expense-type
// transaction counts toward exactly one jar via its category's tag.
export function computeActualAllocation(transactions: Transaction[], categories: Category[], period: string): JarActuals {
    const periodExpenses = transactionsInPeriod(transactions, period).filter((t) => t.type === 'expense');
    const result: JarActuals = { expenses: 0, savings: 0, emergency: 0 };
    for (const t of periodExpenses) {
        const category = categories.find((c) => c.id === t.categoryId);
        const jar = category ? categoryJar(category) : 'expenses';
        result[jar] += t.amount;
    }
    return result;
}

export interface AllocationTarget {
    expensesPct: number;
    savingsPct: number;
    emergencyPct: number;
}

export interface AllocationRecommendation extends AllocationTarget {
    rationale: string;
}

// A context-aware split, not a fixed 50/30/20 -- a thin emergency fund or
// heavy debt load should change where the next naira/dollar goes.
export function recommendAllocationSplit(emergencyFundMonths: number, debtToIncomeRatio: number): AllocationRecommendation {
    if (emergencyFundMonths < 3) {
        return {
            expensesPct: 50, savingsPct: 20, emergencyPct: 30,
            rationale: `Your emergency fund covers only ${emergencyFundMonths.toFixed(1)} month${emergencyFundMonths === 1 ? '' : 's'} of expenses. Weighting more toward Emergency until you reach 3 months closes that gap faster.`,
        };
    }
    if (debtToIncomeRatio > 0.3) {
        return {
            expensesPct: 50, savingsPct: 35, emergencyPct: 15,
            rationale: 'Your emergency fund looks solid, but debt payments are a meaningful share of income. Shifting more toward Savings — and directing it at the highest-interest debt — gets you out of debt faster.',
        };
    }
    return {
        expensesPct: 50, savingsPct: 30, emergencyPct: 20,
        rationale: 'Your emergency fund and debt levels both look healthy — this is a balanced, general-purpose split.',
    };
}

export interface JarInsight {
    jar: JarKey;
    severity: 'good' | 'watch' | 'warning';
    message: string;
}

// Suggestions on what to do about the gap between target and actual for
// each jar this period, not just a number comparison.
export function generateAllocationInsights(target: AllocationTarget, actual: JarActuals, income: number, symbol: string): JarInsight[] {
    if (income <= 0) return [];
    const targets: JarActuals = {
        expenses: (target.expensesPct / 100) * income,
        savings: (target.savingsPct / 100) * income,
        emergency: (target.emergencyPct / 100) * income,
    };

    const insights: JarInsight[] = [];
    if (actual.expenses > targets.expenses * 1.1) {
        insights.push({
            jar: 'expenses', severity: 'warning',
            message: `Expenses are ${symbol}${Math.round(actual.expenses - targets.expenses).toLocaleString()} over your ${symbol}${Math.round(targets.expenses).toLocaleString()} target this month. Review recent spending in the Ledger to find where to cut back.`,
        });
    } else {
        insights.push({ jar: 'expenses', severity: 'good', message: `Expenses are within target (${symbol}${Math.round(actual.expenses).toLocaleString()} of ${symbol}${Math.round(targets.expenses).toLocaleString()}).` });
    }

    for (const jar of ['savings', 'emergency'] as const) {
        const label = JAR_LABELS[jar];
        if (actual[jar] < targets[jar] * 0.7) {
            insights.push({
                jar, severity: 'watch',
                message: `${label} is ${symbol}${Math.round(targets[jar] - actual[jar]).toLocaleString()} behind its ${symbol}${Math.round(targets[jar]).toLocaleString()} target this month. Set up a recurring transfer so this happens automatically.`,
            });
        } else {
            insights.push({ jar, severity: 'good', message: `${label} target met for this month (${symbol}${Math.round(actual[jar]).toLocaleString()} of ${symbol}${Math.round(targets[jar]).toLocaleString()}).` });
        }
    }
    return insights;
}
