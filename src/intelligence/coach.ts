import { FinancialHealthReport, Insight } from '../types';
import { CashFlowSummary } from './cashFlow';
import { healthStatusLabel } from './health';

export type AffordabilityVerdict = 'comfortable' | 'tight' | 'not-recommended';

export interface AffordabilityResult {
    verdict: AffordabilityVerdict;
    resultingMonthlySurplus: number;
    savingsCapacityReductionPct: number;
    narrative: string;
}

export function computeAffordability(monthlyCost: number, cf: CashFlowSummary, symbol: string): AffordabilityResult {
    const resultingMonthlySurplus = cf.surplus - monthlyCost;
    const reductionPct = cf.surplus > 0 ? Math.min(100, (monthlyCost / cf.surplus) * 100) : 100;

    let verdict: AffordabilityVerdict;
    if (resultingMonthlySurplus >= 0 && reductionPct <= 40) verdict = 'comfortable';
    else if (resultingMonthlySurplus >= 0) verdict = 'tight';
    else verdict = 'not-recommended';

    let narrative: string;
    if (verdict === 'comfortable') {
        narrative = `At this payment, your monthly fixed commitments would increase by ${symbol}${Math.round(monthlyCost).toLocaleString()}. Based on current cash flow, this looks comfortable — it would reduce your monthly savings capacity by approximately ${reductionPct.toFixed(0)}%, still leaving a ${symbol}${Math.round(resultingMonthlySurplus).toLocaleString()} surplus.`;
    } else if (verdict === 'tight') {
        narrative = `At this payment, your monthly fixed commitments would increase by ${symbol}${Math.round(monthlyCost).toLocaleString()}. You could afford it based on current cash flow, but it would reduce your monthly savings capacity by approximately ${reductionPct.toFixed(0)}%, leaving only ${symbol}${Math.round(resultingMonthlySurplus).toLocaleString()} of surplus each month.`;
    } else {
        narrative = `At this payment, your monthly fixed commitments would increase by ${symbol}${Math.round(monthlyCost).toLocaleString()} — more than your current monthly surplus. This would put the household ${symbol}${Math.round(Math.abs(resultingMonthlySurplus)).toLocaleString()} into deficit each month at current income and spending levels. Not recommended without increasing income or cutting other expenses first.`;
    }

    return { verdict, resultingMonthlySurplus, savingsCapacityReductionPct: reductionPct, narrative };
}

export function generateCoachSummary(report: FinancialHealthReport, insights: Insight[], symbol: string): { headline: string; focusAreas: string[]; priority: string } {
    const concerns = report.areas.filter((a) => a.status === 'watch' || a.status === 'off-track');
    const headline = concerns.length === 0
        ? 'Your household is financially healthy across every tracked area.'
        : `Your household is financially healthy overall, but there ${concerns.length === 1 ? 'is one area' : `are ${concerns.length} areas`} to focus on:`;

    const focusAreas = concerns.map((a) => `${a.label}: ${healthStatusLabel(a.status)}.`);
    const topInsight = [...insights].sort((a, b) => {
        const rank = { warning: 0, watch: 1, good: 2 } as const;
        return rank[a.severity] - rank[b.severity];
    })[0];

    const priority = topInsight
        ? `Priority: ${topInsight.message}`
        : 'Priority: keep doing what you\'re doing — every tracked area is in good shape.';

    return { headline, focusAreas, priority };
}
