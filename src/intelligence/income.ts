import { IncomeSource, Insight, Transaction } from '../types';
import { last6Periods, shiftPeriod, currentPeriod } from '../utils/date';
import { transactionsInPeriod, sumByType } from './cashFlow';

export interface IncomeConcentration {
    topSourceName: string;
    topSourceSharePct: number;
    totalIncome: number;
}

export function computeIncomeConcentration(transactions: Transaction[], sources: IncomeSource[], monthsBack = 6): IncomeConcentration | null {
    const periods = Array.from({ length: monthsBack }, (_, i) => shiftPeriod(currentPeriod(), -i));
    const incomeTx = transactions.filter((t) => t.type === 'income' && periods.includes(t.date.slice(0, 7)));
    const totalIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
    if (totalIncome === 0) return null;

    const bySource = new Map<string, number>();
    for (const t of incomeTx) {
        const key = t.incomeSourceId || 'unlabeled';
        bySource.set(key, (bySource.get(key) || 0) + t.amount);
    }
    let topKey = '';
    let topAmount = 0;
    for (const [key, amount] of bySource) {
        if (amount > topAmount) { topAmount = amount; topKey = key; }
    }
    const topSourceName = sources.find((s) => s.id === topKey)?.name || 'a single source';
    return { topSourceName, topSourceSharePct: (topAmount / totalIncome) * 100, totalIncome };
}

export function detectSurplusOpportunity(transactions: Transaction[], monthsBack = 6): { avgSurplus: number; monthsWithSurplus: number } {
    const periods = Array.from({ length: monthsBack }, (_, i) => shiftPeriod(currentPeriod(), -1 - i));
    const surpluses = periods.map((p) => {
        const tx = transactionsInPeriod(transactions, p);
        return { period: p, surplus: sumByType(tx, 'income') - sumByType(tx, 'expense'), hasData: tx.length > 0 };
    }).filter((s) => s.hasData);
    const monthsWithSurplus = surpluses.filter((s) => s.surplus > 0).length;
    const avgSurplus = surpluses.length ? surpluses.reduce((sum, s) => sum + s.surplus, 0) / surpluses.length : 0;
    return { avgSurplus, monthsWithSurplus: monthsWithSurplus };
}

export function detectRecurringIrregularIncome(transactions: Transaction[], sources: IncomeSource[]): { source: IncomeSource; monthsSeen: number; avgAmount: number }[] {
    const periods = last6Periods();
    const results: { source: IncomeSource; monthsSeen: number; avgAmount: number }[] = [];
    for (const source of sources.filter((s) => !s.isRecurring)) {
        const tx = transactions.filter((t) => t.incomeSourceId === source.id && periods.includes(t.date.slice(0, 7)));
        const monthsSeen = new Set(tx.map((t) => t.date.slice(0, 7))).size;
        if (monthsSeen >= 3) {
            const avgAmount = tx.reduce((sum, t) => sum + t.amount, 0) / monthsSeen;
            results.push({ source, monthsSeen, avgAmount });
        }
    }
    return results;
}

export function generateIncomeInsights(transactions: Transaction[], sources: IncomeSource[], symbol: string): Insight[] {
    const insights: Insight[] = [];
    const concentration = computeIncomeConcentration(transactions, sources);
    if (concentration && concentration.topSourceSharePct >= 70) {
        insights.push({
            id: 'income-concentration',
            area: 'income',
            severity: 'watch',
            title: 'Income relies heavily on one source',
            message: `Your household depends on ${concentration.topSourceName} for ${concentration.topSourceSharePct.toFixed(0)}% of total income. Consider developing a second recurring income source to reduce concentration risk.`,
        });
    }

    const { avgSurplus, monthsWithSurplus } = detectSurplusOpportunity(transactions, 6);
    if (monthsWithSurplus >= 5 && avgSurplus > 0) {
        insights.push({
            id: 'income-surplus-opportunity',
            area: 'income',
            severity: 'good',
            title: 'Consistent surplus — room to invest in more income',
            message: `Your household has maintained a monthly surplus of approximately ${symbol}${Math.round(avgSurplus).toLocaleString()} for ${monthsWithSurplus} of the last 6 months. You may be able to allocate part of this toward a new income-generating activity without affecting your existing goals.`,
        });
    }

    for (const { source, monthsSeen, avgAmount } of detectRecurringIrregularIncome(transactions, sources)) {
        insights.push({
            id: `income-recurring-${source.id}`,
            area: 'income',
            severity: 'good',
            title: `${source.name} looks like a recurring source`,
            message: `You've received income from ${source.name} in ${monthsSeen} of the last 6 months, averaging ${symbol}${Math.round(avgAmount).toLocaleString()}. If this can be made reliably recurring, it could add approximately ${symbol}${Math.round(avgAmount * 12).toLocaleString()} to annual household income.`,
        });
    }

    return insights;
}
