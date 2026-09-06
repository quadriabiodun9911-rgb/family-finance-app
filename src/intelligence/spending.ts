import { Category, Insight, Transaction } from '../types';
import { shiftPeriod, currentPeriod } from '../utils/date';
import { transactionsInPeriod } from './cashFlow';

export interface CategoryTrend {
    category: Category;
    months: { period: string; total: number }[];
    latestTotal: number;
    priorTotal: number;
    changePct: number | null;
    consecutiveIncreaseMonths: number;
    vsTargetPct: number | null; // % above/below category.monthlyTarget, null if no target set
    projectedAnnualOverage: number | null;
}

function categoryTotalForPeriod(transactions: Transaction[], categoryId: string, period: string): number {
    return transactionsInPeriod(transactions, period)
        .filter((t) => t.categoryId === categoryId)
        .reduce((sum, t) => sum + t.amount, 0);
}

export function computeCategoryTrend(transactions: Transaction[], category: Category, monthsBack = 4): CategoryTrend {
    const periods = Array.from({ length: monthsBack }, (_, i) => shiftPeriod(currentPeriod(), -(monthsBack - 1 - i)));
    const months = periods.map((period) => ({ period, total: categoryTotalForPeriod(transactions, category.id, period) }));
    const latestTotal = months[months.length - 1]?.total ?? 0;
    const priorTotal = months[months.length - 2]?.total ?? 0;
    const changePct = priorTotal > 0 ? ((latestTotal - priorTotal) / priorTotal) * 100 : (latestTotal > 0 ? 100 : null);

    let consecutiveIncreaseMonths = 0;
    for (let i = months.length - 1; i > 0; i--) {
        if (months[i].total > months[i - 1].total && months[i].total > 0) consecutiveIncreaseMonths++;
        else break;
    }

    const vsTargetPct = category.monthlyTarget ? ((latestTotal - category.monthlyTarget) / category.monthlyTarget) * 100 : null;
    const projectedAnnualOverage = category.monthlyTarget && latestTotal > category.monthlyTarget
        ? (latestTotal - category.monthlyTarget) * 12
        : null;

    return { category, months, latestTotal, priorTotal, changePct, consecutiveIncreaseMonths, vsTargetPct, projectedAnnualOverage };
}

export function computeAllCategoryTrends(transactions: Transaction[], categories: Category[]): CategoryTrend[] {
    return categories.filter((c) => c.type === 'expense').map((c) => computeCategoryTrend(transactions, c));
}

export function generateSpendingInsights(trends: CategoryTrend[], symbol: string): Insight[] {
    const insights: Insight[] = [];
    for (const t of trends) {
        if (t.consecutiveIncreaseMonths >= 3 && t.vsTargetPct !== null && t.vsTargetPct > 0) {
            insights.push({
                id: `spend-streak-${t.category.id}`,
                area: 'spending',
                severity: 'warning',
                title: `${t.category.name} rising for ${t.consecutiveIncreaseMonths} months straight`,
                message: `${t.category.name} spending has increased for ${t.consecutiveIncreaseMonths} consecutive months and is now ${t.vsTargetPct.toFixed(0)}% above your target.${t.projectedAnnualOverage ? ` At the current rate, you'll spend approximately ${symbol}${Math.round(t.projectedAnnualOverage).toLocaleString()} more than planned over the next 12 months.` : ''}`,
            });
        } else if (t.changePct !== null && t.changePct >= 18) {
            insights.push({
                id: `spend-jump-${t.category.id}`,
                area: 'spending',
                severity: 'watch',
                title: `${t.category.name} up ${t.changePct.toFixed(0)}% this month`,
                message: `${t.category.name} spending increased ${t.changePct.toFixed(0)}% compared to last month (${symbol}${Math.round(t.priorTotal).toLocaleString()} → ${symbol}${Math.round(t.latestTotal).toLocaleString()}). Worth checking whether this is a one-off or the start of a trend.`,
            });
        } else if (t.changePct !== null && t.changePct <= -15 && t.priorTotal > 0) {
            insights.push({
                id: `spend-drop-${t.category.id}`,
                area: 'spending',
                severity: 'good',
                title: `${t.category.name} down ${Math.abs(t.changePct).toFixed(0)}%`,
                message: `${t.category.name} spending decreased ${Math.abs(t.changePct).toFixed(0)}% compared to last month.`,
            });
        }
    }
    return insights;
}

export function topMovers(trends: CategoryTrend[], limit = 3): CategoryTrend[] {
    return [...trends]
        .filter((t) => t.changePct !== null)
        .sort((a, b) => Math.abs(b.latestTotal - b.priorTotal) - Math.abs(a.latestTotal - a.priorTotal))
        .slice(0, limit);
}
