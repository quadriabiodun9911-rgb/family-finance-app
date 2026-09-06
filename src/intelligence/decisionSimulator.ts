import { CashFlowSummary } from './cashFlow';

export type DecisionType = 'new_expense' | 'new_debt' | 'income_change' | 'one_time_purchase';

export interface DecisionInput {
    type: DecisionType;
    label: string;
    monthlyAmount: number; // new_expense/new_debt: positive cost; income_change: signed (negative = a pay cut or job loss)
    oneTimeAmount: number; // one_time_purchase only
    termMonths?: number; // new_debt only, informational
}

export type DecisionVerdict = 'safe' | 'caution' | 'risky';

export interface DecisionImpact {
    verdict: DecisionVerdict;
    currentSurplus: number;
    projectedSurplus: number;
    currentSavingsRatePct: number;
    projectedSavingsRatePct: number;
    emergencyFundMonthsBefore: number;
    emergencyFundMonthsAfter: number;
    narrative: string;
    recommendation: string;
}

export function simulateDecision(
    input: DecisionInput,
    cashFlow: CashFlowSummary,
    liquidCash: number,
    avgMonthlyExpense: number,
    symbol: string,
): DecisionImpact {
    const isIncomeChange = input.type === 'income_change';
    const monthlyDelta = isIncomeChange ? input.monthlyAmount : -Math.abs(input.monthlyAmount);
    const projectedIncome = Math.max(0, cashFlow.income + (isIncomeChange ? input.monthlyAmount : 0));
    const projectedExpense = cashFlow.expense + (!isIncomeChange && input.type !== 'one_time_purchase' ? Math.abs(input.monthlyAmount) : 0);
    const projectedSurplus = projectedIncome - projectedExpense;

    const currentSavingsRatePct = cashFlow.income > 0 ? (cashFlow.surplus / cashFlow.income) * 100 : 0;
    const projectedSavingsRatePct = projectedIncome > 0 ? (projectedSurplus / projectedIncome) * 100 : 0;

    const emergencyFundMonthsBefore = avgMonthlyExpense > 0 ? liquidCash / avgMonthlyExpense : (liquidCash > 0 ? 99 : 0);
    const liquidCashAfter = liquidCash - (input.type === 'one_time_purchase' ? input.oneTimeAmount : 0);
    const projectedAvgExpense = avgMonthlyExpense + (!isIncomeChange && input.type !== 'one_time_purchase' ? Math.abs(input.monthlyAmount) : 0);
    const emergencyFundMonthsAfter = projectedAvgExpense > 0 ? liquidCashAfter / projectedAvgExpense : (liquidCashAfter > 0 ? 99 : 0);

    // Judge the decision itself, not just the resulting absolute state -- an
    // already-thin emergency fund shouldn't make a pure income increase look
    // "risky" just because the fund is still thin afterward. Only count it
    // against the decision if the decision itself makes the reserve worse.
    const worsensReserve = emergencyFundMonthsAfter < emergencyFundMonthsBefore - 0.01;
    const worsensSurplus = monthlyDelta < 0;

    let verdict: DecisionVerdict = 'safe';
    if (projectedSurplus < 0 || (worsensReserve && emergencyFundMonthsAfter < 1)) verdict = 'risky';
    else if ((worsensReserve && emergencyFundMonthsAfter < 3) || (worsensSurplus && projectedSavingsRatePct < currentSavingsRatePct * 0.6)) verdict = 'caution';

    let narrative: string;
    if (input.type === 'one_time_purchase') {
        narrative = `Paying ${symbol}${Math.round(input.oneTimeAmount).toLocaleString()} in cash for "${input.label}" would take your cash on hand from ${symbol}${Math.round(liquidCash).toLocaleString()} to ${symbol}${Math.round(liquidCashAfter).toLocaleString()} — dropping your emergency fund cover from ${emergencyFundMonthsBefore.toFixed(1)} to ${emergencyFundMonthsAfter.toFixed(1)} months of expenses. Your monthly surplus is unaffected.`;
    } else if (isIncomeChange) {
        const direction = input.monthlyAmount >= 0 ? 'increases' : 'decreases';
        narrative = `If household income ${direction} by ${symbol}${Math.round(Math.abs(input.monthlyAmount)).toLocaleString()}/month ("${input.label}"), your monthly surplus would go from ${symbol}${Math.round(cashFlow.surplus).toLocaleString()} to ${symbol}${Math.round(projectedSurplus).toLocaleString()} — a savings rate of ${projectedSavingsRatePct.toFixed(0)}% of income, versus ${currentSavingsRatePct.toFixed(0)}% today.`;
    } else {
        const kind = input.type === 'new_debt' ? 'loan payment' : 'monthly cost';
        const term = input.type === 'new_debt' && input.termMonths ? ` over ${input.termMonths} months` : '';
        narrative = `Adding a ${symbol}${Math.round(input.monthlyAmount).toLocaleString()}/month ${kind} for "${input.label}"${term} would take your monthly surplus from ${symbol}${Math.round(cashFlow.surplus).toLocaleString()} to ${symbol}${Math.round(projectedSurplus).toLocaleString()}, reducing your savings rate from ${currentSavingsRatePct.toFixed(0)}% to ${projectedSavingsRatePct.toFixed(0)}% of income.`;
    }

    const isBeneficial = isIncomeChange && input.monthlyAmount > 0;
    let recommendation: string;
    if (verdict === 'risky') {
        recommendation = projectedSurplus < 0
            ? 'This would put the household into a monthly deficit at current income and spending. Not recommended without increasing income or cutting other costs first.'
            : 'This would leave less than a month of expenses in reserve. Build a buffer first, or reduce the size of this commitment.';
    } else if (verdict === 'caution') {
        recommendation = 'Affordable, but it meaningfully reduces your safety margin. Worth doing only if this is a priority you\'re prepared to trade other spending for.';
    } else if (isBeneficial) {
        recommendation = emergencyFundMonthsAfter < 3
            ? 'A solid move — consider directing some of the extra income toward your emergency fund, which is still thinner than the 3-month target.'
            : 'A solid move for the household\'s finances, with no downside from this decision alone.';
    } else {
        recommendation = 'This looks comfortable based on your current cash flow and reserves.';
    }

    return {
        verdict, currentSurplus: cashFlow.surplus, projectedSurplus, currentSavingsRatePct, projectedSavingsRatePct,
        emergencyFundMonthsBefore, emergencyFundMonthsAfter, narrative, recommendation,
    };
}
