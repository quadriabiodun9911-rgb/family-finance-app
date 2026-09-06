import { Account, Debt, FinancialGoal, HouseholdMember, Transaction } from '../types';
import { CashFlowSummary, transactionsInPeriod, sumByType } from './cashFlow';
import { BudgetLine } from './budgetPlan';
import { GoalPace } from './goalPace';
import { IncomeConcentration } from './income';
import { shiftPeriod, currentPeriod } from '../utils/date';

export type RiskSeverity = 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFactor {
    id: string;
    severity: RiskSeverity;
    title: string;
    message: string;
    recommendation: string;
}

export interface RiskReport {
    overallLevel: RiskLevel;
    liquidCash: number;
    avgMonthlyExpense: number;
    emergencyFundMonths: number;
    factors: RiskFactor[];
}

export function averageMonthlyExpense(transactions: Transaction[], monthsBack = 3): number {
    const periods = Array.from({ length: monthsBack }, (_, i) => shiftPeriod(currentPeriod(), -i));
    const totals = periods
        .map((p) => sumByType(transactionsInPeriod(transactions, p), 'expense'))
        .filter((t) => t > 0);
    if (totals.length === 0) return 0;
    return totals.reduce((a, b) => a + b, 0) / totals.length;
}

export function computeRiskReport(
    transactions: Transaction[],
    accounts: Account[],
    debts: Debt[],
    budgetLines: BudgetLine[],
    goalPaces: GoalPace[],
    cashFlow: CashFlowSummary,
    incomeConcentration: IncomeConcentration | null,
    members: HouseholdMember[],
    symbol: string,
): RiskReport {
    const factors: RiskFactor[] = [];
    const liquidCash = accounts.reduce((sum, a) => sum + a.balance, 0);
    const avgExpense = averageMonthlyExpense(transactions, 3) || cashFlow.expense;
    const emergencyFundMonths = avgExpense > 0 ? liquidCash / avgExpense : (liquidCash > 0 ? 99 : 0);

    if (emergencyFundMonths < 1) {
        factors.push({
            id: 'emergency-fund-critical',
            severity: 'high',
            title: 'Almost no financial cushion',
            message: `Your cash on hand (${symbol}${Math.round(liquidCash).toLocaleString()}) covers less than a month of expenses at your current spending rate.`,
            recommendation: 'Build a small buffer before anything else — even one month of expenses in cash meaningfully reduces risk from a missed paycheck or surprise bill.',
        });
    } else if (emergencyFundMonths < 3) {
        factors.push({
            id: 'emergency-fund-thin',
            severity: 'medium',
            title: 'Emergency fund below 3 months',
            message: `Your cash on hand covers about ${emergencyFundMonths.toFixed(1)} months of expenses. Most guidance targets 3–6 months.`,
            recommendation: `Redirect part of your monthly surplus toward an emergency fund goal until you reach 3 months (${symbol}${Math.round(avgExpense * 3).toLocaleString()}).`,
        });
    }

    const monthlyDebtPayments = debts.reduce((sum, d) => sum + (d.minPayment || 0), 0);
    const debtToIncomeRatio = cashFlow.income > 0 ? monthlyDebtPayments / cashFlow.income : 0;
    if (debtToIncomeRatio > 0.4) {
        factors.push({
            id: 'debt-ratio-high',
            severity: 'high',
            title: 'Debt payments are a large share of income',
            message: `Minimum debt payments (${symbol}${Math.round(monthlyDebtPayments).toLocaleString()}/month) are ${(debtToIncomeRatio * 100).toFixed(0)}% of income — above the 40% level lenders generally treat as high-risk.`,
            recommendation: 'Prioritize paying down the highest-interest debt first, and avoid taking on any new debt until this ratio comes down.',
        });
    } else if (debtToIncomeRatio > 0.2) {
        factors.push({
            id: 'debt-ratio-watch',
            severity: 'medium',
            title: 'Debt payments are a meaningful share of income',
            message: `Minimum debt payments are ${(debtToIncomeRatio * 100).toFixed(0)}% of income.`,
            recommendation: 'Manageable today, but leaves less room to absorb an income shock — worth keeping an eye on before adding new fixed costs.',
        });
    }

    if (incomeConcentration && incomeConcentration.topSourceSharePct >= 70) {
        factors.push({
            id: 'income-concentration',
            severity: incomeConcentration.topSourceSharePct >= 90 ? 'high' : 'medium',
            title: 'Income depends on one source',
            message: `${incomeConcentration.topSourceSharePct.toFixed(0)}% of household income comes from ${incomeConcentration.topSourceName}.`,
            recommendation: 'Losing this source would hit the household hard. A second income stream — even a small one — meaningfully reduces this risk.',
        });
    }

    if (members.length > 1) {
        const sixMonthsAgo = shiftPeriod(currentPeriod(), -5);
        const recentIncomeTx = transactions.filter((t) => t.type === 'income' && t.date.slice(0, 7) >= sixMonthsAgo);
        const earners = new Set(recentIncomeTx.map((t) => t.memberId).filter(Boolean));
        if (earners.size <= 1 && recentIncomeTx.length > 0) {
            factors.push({
                id: 'single-earner',
                severity: 'medium',
                title: 'Only one household member has recorded income',
                message: 'Over the last 6 months, income has come from just one member of the household.',
                recommendation: 'Consider whether a second income source is realistic — it reduces how exposed the household is to that one person\'s job or health.',
            });
        }
    }

    if (budgetLines.length >= 3) {
        const overShare = budgetLines.filter((l) => l.paceStatus === 'over').length / budgetLines.length;
        if (overShare > 0.5) {
            factors.push({
                id: 'budget-overrun-chronic',
                severity: 'high',
                title: 'Most budget categories are running over',
                message: `${Math.round(overShare * 100)}% of your budgeted categories are on pace to exceed their plan this month.`,
                recommendation: 'Your budget may no longer reflect real spending. Revisit the planned amounts, or the spending itself — one of the two needs to move.',
            });
        } else if (overShare > 0.25) {
            factors.push({
                id: 'budget-overrun-watch',
                severity: 'medium',
                title: 'Several budget categories are running over',
                message: `${Math.round(overShare * 100)}% of budgeted categories are on pace to exceed their plan this month.`,
                recommendation: 'Check the Budget tab for which categories are furthest ahead of pace.',
            });
        }
    }

    const upcomingTotal = cashFlow.upcomingBills.reduce((sum, u) => sum + u.bill.amount, 0);
    if (upcomingTotal > 0 && upcomingTotal > cashFlow.discretionaryCash) {
        const severity: RiskSeverity = upcomingTotal > cashFlow.accountsBalance ? 'high' : 'medium';
        factors.push({
            id: 'liquidity-upcoming-bills',
            severity,
            title: 'Upcoming bills exceed available discretionary cash',
            message: `${symbol}${Math.round(upcomingTotal).toLocaleString()} in bills are due within 14 days, against ${symbol}${Math.round(cashFlow.discretionaryCash).toLocaleString()} in cash not already committed elsewhere.`,
            recommendation: severity === 'high'
                ? 'This is tight enough that a bill could bounce. Hold off on any discretionary spending until these clear.'
                : 'Manageable, but keep discretionary spending light until these bills clear.',
        });
    }

    const offTrackGoals = goalPaces.filter((g) => g.onTrack === false);
    if (offTrackGoals.length >= 2) {
        factors.push({
            id: 'goals-off-track',
            severity: offTrackGoals.length >= goalPaces.length ? 'high' : 'medium',
            title: `${offTrackGoals.length} goals are behind pace`,
            message: offTrackGoals.map((g) => g.goal.title).join(', ') + ' are not on track to hit their deadlines at the current contribution rate.',
            recommendation: 'Open the Goals tab — each goal shows exactly how much more to contribute monthly to get back on schedule.',
        });
    }

    const severityRank: Record<RiskSeverity, number> = { high: 2, medium: 1 };
    factors.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

    const overallLevel: RiskLevel = factors.some((f) => f.severity === 'high') ? 'high' : factors.some((f) => f.severity === 'medium') ? 'medium' : 'low';

    return { overallLevel, liquidCash, avgMonthlyExpense: avgExpense, emergencyFundMonths, factors };
}
