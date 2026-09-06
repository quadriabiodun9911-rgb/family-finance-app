import { Account, Debt, FinancialGoal, Investment, OtherAsset, NetWorthSnapshot } from '../types';

export interface NetWorthBreakdown {
    cash: number;
    savings: number;
    investments: number;
    otherAssets: number;
    totalAssets: number;
    debts: number;
    totalLiabilities: number;
    netWorth: number;
}

export function computeNetWorth(
    accounts: Account[],
    goals: FinancialGoal[],
    investments: Investment[],
    otherAssets: OtherAsset[],
    debts: Debt[],
): NetWorthBreakdown {
    const cash = accounts.reduce((sum, a) => sum + a.balance, 0);
    const savings = goals.filter((g) => g.type !== 'debt').reduce((sum, g) => sum + Math.max(0, g.currentValue), 0);
    const investmentTotal = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const otherTotal = otherAssets.reduce((sum, a) => sum + a.value, 0);
    const debtTotal = debts.reduce((sum, d) => sum + d.balance, 0);
    const totalAssets = cash + savings + investmentTotal + otherTotal;
    return {
        cash,
        savings,
        investments: investmentTotal,
        otherAssets: otherTotal,
        totalAssets,
        debts: debtTotal,
        totalLiabilities: debtTotal,
        netWorth: totalAssets - debtTotal,
    };
}

export function netWorthTrend(history: NetWorthSnapshot[]): { deltaAmount: number; deltaPct: number } | null {
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const prior = sorted[sorted.length - 2];
    const deltaAmount = latest.netWorth - prior.netWorth;
    const deltaPct = prior.netWorth !== 0 ? (deltaAmount / Math.abs(prior.netWorth)) * 100 : 0;
    return { deltaAmount, deltaPct };
}
