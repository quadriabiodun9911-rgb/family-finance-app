import { Category, FinancialGoal, Insight, Transaction } from '../types';
import { addDaysISO, daysBetween, todayISO } from '../utils/date';

export interface CategoryPattern {
    categoryId: string;
    categoryName: string;
    avgIntervalDays: number;
    avgAmount: number;
    lastDate: string;
    nextExpectedDate: string;
    daysUntilExpected: number; // negative = overdue relative to the pattern
    transactionCount: number;
}

// Finds expense categories the household spends on regularly enough to have
// a real rhythm -- at least 3 transactions in the recent window, which is
// enough to compute a meaningful average gap between purchases. One-off
// categories are left out rather than forced into a false pattern.
export function detectCategoryPatterns(transactions: Transaction[], categories: Category[], monthsBack = 3): CategoryPattern[] {
    const windowStart = addDaysISO(todayISO(), -monthsBack * 30);
    const byCategory = new Map<string, Transaction[]>();
    for (const t of transactions) {
        if (t.type !== 'expense' || t.date < windowStart) continue;
        const list = byCategory.get(t.categoryId) || [];
        list.push(t);
        byCategory.set(t.categoryId, list);
    }

    const patterns: CategoryPattern[] = [];
    for (const [categoryId, txs] of byCategory) {
        if (txs.length < 3) continue;
        const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
        const avgIntervalDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (avgIntervalDays < 1) continue; // multiple same-day entries -- not a cadence
        const avgAmount = sorted.reduce((s, t) => s + t.amount, 0) / sorted.length;
        const lastDate = sorted[sorted.length - 1].date;
        const nextExpectedDate = addDaysISO(lastDate, Math.round(avgIntervalDays));
        patterns.push({
            categoryId,
            categoryName: categories.find((c) => c.id === categoryId)?.name || 'Uncategorized',
            avgIntervalDays, avgAmount, lastDate, nextExpectedDate,
            daysUntilExpected: daysBetween(todayISO(), nextExpectedDate),
            transactionCount: sorted.length,
        });
    }
    return patterns.sort((a, b) => a.daysUntilExpected - b.daysUntilExpected);
}

export interface GoalContributionPattern {
    goalId: string;
    goalTitle: string;
    avgIntervalDays: number;
    avgAmount: number;
    lastDate: string;
    nextExpectedDate: string;
    daysOverdue: number; // 0 or negative means on schedule
}

export function detectGoalContributionPatterns(goals: FinancialGoal[]): GoalContributionPattern[] {
    const patterns: GoalContributionPattern[] = [];
    for (const g of goals) {
        const positive = g.contributions.filter((c) => c.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
        if (positive.length < 3) continue;
        const gaps: number[] = [];
        for (let i = 1; i < positive.length; i++) gaps.push(daysBetween(positive[i - 1].date, positive[i].date));
        const avgIntervalDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (avgIntervalDays < 1) continue;
        const avgAmount = positive.reduce((s, c) => s + c.amount, 0) / positive.length;
        const lastDate = positive[positive.length - 1].date;
        const nextExpectedDate = addDaysISO(lastDate, Math.round(avgIntervalDays));
        const daysOverdue = daysBetween(nextExpectedDate, todayISO());
        patterns.push({ goalId: g.id, goalTitle: g.title, avgIntervalDays, avgAmount, lastDate, nextExpectedDate, daysOverdue });
    }
    return patterns.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// Turns the raw patterns into the same Insight shape every other part of
// the app already uses, so these slot straight into the daily insight
// rotation and the Coach screen without a parallel notification system.
export function generateBehaviorInsights(
    categoryPatterns: CategoryPattern[],
    goalPatterns: GoalContributionPattern[],
    symbol: string,
): Insight[] {
    const insights: Insight[] = [];

    for (const p of categoryPatterns.slice(0, 3)) {
        if (p.daysUntilExpected <= 3 && p.daysUntilExpected >= -14) {
            const dueText = p.daysUntilExpected <= 0
                ? `is about ${Math.abs(p.daysUntilExpected)} day${Math.abs(p.daysUntilExpected) === 1 ? '' : 's'} overdue based on your usual pattern`
                : `is expected in about ${p.daysUntilExpected} day${p.daysUntilExpected === 1 ? '' : 's'}`;
            insights.push({
                id: `pattern-category-${p.categoryId}`,
                area: 'spending',
                severity: 'watch',
                title: `Your next ${p.categoryName} spend ${p.daysUntilExpected <= 0 ? 'is due' : 'is coming up'}`,
                message: `You typically spend on ${p.categoryName} every ~${Math.round(p.avgIntervalDays)} days, averaging ${symbol}${Math.round(p.avgAmount).toLocaleString()}. Your last one was on ${p.lastDate}, so the next one ${dueText}.`,
            });
        }
    }

    for (const p of goalPatterns.slice(0, 2)) {
        if (p.daysOverdue > Math.max(3, p.avgIntervalDays * 0.5)) {
            insights.push({
                id: `pattern-goal-${p.goalId}`,
                area: 'goals',
                severity: p.daysOverdue > p.avgIntervalDays ? 'warning' : 'watch',
                title: `${p.goalTitle} contribution is overdue`,
                message: `You usually contribute to ${p.goalTitle} every ~${Math.round(p.avgIntervalDays)} days (about ${symbol}${Math.round(p.avgAmount).toLocaleString()} each time). It's been ${p.daysOverdue + Math.round(p.avgIntervalDays)} days since your last one — keeping the rhythm going matters more than the amount.`,
            });
        }
    }

    return insights;
}
