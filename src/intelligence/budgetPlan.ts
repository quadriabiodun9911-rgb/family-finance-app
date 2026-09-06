import { Budget, Category, Insight, Transaction } from '../types';
import { currentPeriod, daysInMonth, daysRemainingInPeriod } from '../utils/date';
import { transactionsInPeriod } from './cashFlow';

export type PaceStatus = 'on-track' | 'watch' | 'over';

export interface BudgetLine {
    category: Category;
    planned: number;
    actual: number;
    remaining: number;
    pctUsed: number; // actual / planned * 100
    pctTimeElapsed: number;
    projectedTotal: number; // actual / elapsedDays * totalDays
    paceStatus: PaceStatus;
    daysRemaining: number;
}

export function computeBudgetLines(budgets: Budget[], categories: Category[], transactions: Transaction[], period: string = currentPeriod()): BudgetLine[] {
    const totalDays = daysInMonth(period);
    const daysRemaining = daysRemainingInPeriod(period);
    const elapsedDays = Math.max(1, totalDays - daysRemaining);
    const pctTimeElapsed = (elapsedDays / totalDays) * 100;
    const periodTx = transactionsInPeriod(transactions, period).filter((t) => t.type === 'expense');

    return budgets
        .filter((b) => b.period === period)
        .map((b) => {
            const category = categories.find((c) => c.id === b.categoryId);
            if (!category) return null;
            const actual = periodTx.filter((t) => t.categoryId === b.categoryId).reduce((sum, t) => sum + t.amount, 0);
            const pctUsed = b.planned > 0 ? (actual / b.planned) * 100 : 0;
            const projectedTotal = (actual / elapsedDays) * totalDays;
            let paceStatus: PaceStatus = 'on-track';
            if (pctUsed >= 100 || projectedTotal > b.planned * 1.1) paceStatus = 'over';
            else if (pctUsed - pctTimeElapsed >= 15) paceStatus = 'watch';
            return {
                category, planned: b.planned, actual, remaining: Math.max(0, b.planned - actual),
                pctUsed, pctTimeElapsed, projectedTotal, paceStatus, daysRemaining,
            };
        })
        .filter((b): b is BudgetLine => b !== null);
}

export function generateBudgetInsights(lines: BudgetLine[], symbol: string): Insight[] {
    const insights: Insight[] = [];
    for (const line of lines) {
        if (line.paceStatus === 'over' && line.pctUsed < 100) {
            insights.push({
                id: `budget-over-${line.category.id}`,
                area: 'budget',
                severity: 'warning',
                title: `${line.category.name} on pace to exceed budget`,
                message: `You've used ${line.pctUsed.toFixed(0)}% of your ${line.category.name} budget with ${line.daysRemaining} day${line.daysRemaining === 1 ? '' : 's'} remaining. At this pace you'll spend about ${symbol}${Math.round(line.projectedTotal).toLocaleString()} against a ${symbol}${Math.round(line.planned).toLocaleString()} plan.`,
            });
        } else if (line.paceStatus === 'over') {
            insights.push({
                id: `budget-exceeded-${line.category.id}`,
                area: 'budget',
                severity: 'warning',
                title: `${line.category.name} budget exceeded`,
                message: `${line.category.name} is already ${symbol}${Math.round(line.actual - line.planned).toLocaleString()} over its ${symbol}${Math.round(line.planned).toLocaleString()} monthly plan with ${line.daysRemaining} day${line.daysRemaining === 1 ? '' : 's'} left.`,
            });
        } else if (line.paceStatus === 'watch') {
            insights.push({
                id: `budget-watch-${line.category.id}`,
                area: 'budget',
                severity: 'watch',
                title: `${line.category.name} running ahead of pace`,
                message: `You have already used ${line.pctUsed.toFixed(0)}% of your ${line.category.name} budget with ${line.daysRemaining} day${line.daysRemaining === 1 ? '' : 's'} remaining.`,
            });
        }
    }
    return insights;
}
