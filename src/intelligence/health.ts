import { FinancialHealthReport, HealthAreaScore, HealthAreaStatus, Insight } from '../types';
import { CashFlowSummary } from './cashFlow';
import { BudgetLine } from './budgetPlan';
import { GoalPace } from './goalPace';
import { Debt } from '../types';

const STATUS_POINTS: Record<HealthAreaStatus, number> = { strong: 100, 'on-track': 80, watch: 55, 'off-track': 25 };

function cashFlowStatus(cf: CashFlowSummary): HealthAreaStatus {
    if (cf.income <= 0) return cf.expense > 0 ? 'off-track' : 'watch';
    const ratio = (cf.surplus / cf.income) * 100;
    if (ratio >= 15) return 'strong';
    if (ratio >= 5) return 'on-track';
    if (ratio >= 0) return 'watch';
    return 'off-track';
}

function budgetStatus(lines: BudgetLine[]): HealthAreaStatus {
    if (lines.length === 0) return 'on-track';
    const overShare = lines.filter((l) => l.paceStatus === 'over').length / lines.length;
    if (overShare === 0) return 'strong';
    if (overShare <= 0.2) return 'on-track';
    if (overShare <= 0.4) return 'watch';
    return 'off-track';
}

function savingsStatus(paces: GoalPace[]): HealthAreaStatus {
    const relevant = paces.filter((p) => p.goal.type === 'savings' || p.goal.type === 'investment');
    if (relevant.length === 0) return 'on-track';
    const judged = relevant.filter((p) => p.onTrack !== null);
    if (judged.length === 0) return 'on-track';
    const onTrackShare = judged.filter((p) => p.onTrack).length / judged.length;
    if (onTrackShare === 1) return 'strong';
    if (onTrackShare >= 0.6) return 'on-track';
    if (onTrackShare >= 0.3) return 'watch';
    return 'off-track';
}

function debtStatus(debts: Debt[], paces: GoalPace[]): HealthAreaStatus {
    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
    if (totalDebt <= 0) return 'strong';
    const debtGoals = paces.filter((p) => p.goal.type === 'debt');
    if (debtGoals.length === 0) return 'watch';
    const paying = debtGoals.some((p) => p.monthlyRate > 0);
    if (!paying) return 'off-track';
    return debtGoals.every((p) => p.onTrack !== false) ? 'on-track' : 'watch';
}

function incomeStatus(incomeInsights: Insight[]): HealthAreaStatus {
    if (incomeInsights.some((i) => i.severity === 'warning')) return 'off-track';
    if (incomeInsights.some((i) => i.severity === 'watch')) return 'watch';
    if (incomeInsights.some((i) => i.severity === 'good')) return 'strong';
    return 'on-track';
}

export function computeFinancialHealthReport(
    cashFlow: CashFlowSummary,
    budgetLines: BudgetLine[],
    goalPaces: GoalPace[],
    debts: Debt[],
    incomeInsights: Insight[],
): FinancialHealthReport {
    const areas: HealthAreaScore[] = [
        { area: 'cashflow', label: 'Cash Flow', status: cashFlowStatus(cashFlow) },
        { area: 'budget', label: 'Budget', status: budgetStatus(budgetLines) },
        { area: 'goals', label: 'Savings', status: savingsStatus(goalPaces) },
        { area: 'networth', label: 'Debt', status: debtStatus(debts, goalPaces) },
        { area: 'income', label: 'Income Growth', status: incomeStatus(incomeInsights) },
    ];
    const score = Math.round(areas.reduce((sum, a) => sum + STATUS_POINTS[a.status], 0) / areas.length);
    return { score, areas };
}

export function healthStatusLabel(status: HealthAreaStatus): string {
    switch (status) {
        case 'strong': return 'Strong';
        case 'on-track': return 'On track';
        case 'watch': return 'Opportunity';
        case 'off-track': return 'Needs attention';
    }
}

// A single top-line read on the whole household, mirroring the per-area
// point bands above (strong=100, on-track=80, watch=55, off-track=25).
export type HealthVerdict = 'healthy' | 'attention' | 'critical';

export function healthVerdict(score: number): HealthVerdict {
    if (score >= 80) return 'healthy';
    if (score >= 55) return 'attention';
    return 'critical';
}

export function healthVerdictLabel(verdict: HealthVerdict): string {
    switch (verdict) {
        case 'healthy': return 'Healthy';
        case 'attention': return 'Needs attention';
        case 'critical': return 'Critical';
    }
}
