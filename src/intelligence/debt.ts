import { Debt, OtherAsset } from '../types';

export interface AmortizationResult {
    months: number | null; // null = payment doesn't even cover the interest -- this debt never gets paid off at this rate
    totalInterest: number | null;
    viable: boolean;
}

export function computeAmortization(balance: number, aprPct: number | undefined, monthlyPayment: number | undefined): AmortizationResult {
    if (!monthlyPayment || monthlyPayment <= 0 || balance <= 0) return { months: null, totalInterest: null, viable: false };
    const monthlyRate = (aprPct || 0) / 100 / 12;
    if (monthlyRate === 0) {
        const months = Math.ceil(balance / monthlyPayment);
        return { months, totalInterest: 0, viable: true };
    }
    const interestOnly = balance * monthlyRate;
    if (monthlyPayment <= interestOnly) return { months: null, totalInterest: null, viable: false };
    const months = Math.ceil(-Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate));
    const totalInterest = Math.max(0, monthlyPayment * months - balance);
    return { months, totalInterest, viable: true };
}

export interface DebtSummary {
    totalBalance: number;
    totalMonthlyPayments: number;
    weightedAvgAprPct: number;
    // Both computed over the viable debts only -- a single stuck debt (its
    // minimum payment not even covering interest) shouldn't blank out a
    // projection for every other debt that's perfectly on track.
    debtFreeMonths: number | null; // null only when EVERY debt is non-viable
    totalInterestRemaining: number | null;
    nonViableDebts: Debt[];
}

export function computeDebtSummary(debts: Debt[]): DebtSummary {
    const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
    const totalMonthlyPayments = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
    const weightedAvgAprPct = totalBalance > 0 ? debts.reduce((s, d) => s + d.balance * (d.aprPct || 0), 0) / totalBalance : 0;

    let debtFreeMonths = 0;
    let totalInterestRemaining = 0;
    let viableCount = 0;
    const nonViableDebts: Debt[] = [];
    for (const d of debts) {
        const amort = computeAmortization(d.balance, d.aprPct, d.minPayment);
        if (!amort.viable) { nonViableDebts.push(d); continue; }
        viableCount++;
        debtFreeMonths = Math.max(debtFreeMonths, amort.months ?? 0);
        totalInterestRemaining += amort.totalInterest ?? 0;
    }

    return {
        totalBalance, totalMonthlyPayments, weightedAvgAprPct,
        debtFreeMonths: viableCount > 0 ? debtFreeMonths : null,
        totalInterestRemaining: viableCount > 0 ? totalInterestRemaining : null,
        nonViableDebts,
    };
}

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface PayoffSimResult {
    months: number;
    totalInterestPaid: number;
    payoffOrder: { debtId: string; name: string; monthPaidOff: number }[];
    hitCap: boolean;
}

const MAX_SIM_MONTHS = 600; // 50 years -- a hard stop so a non-viable debt can't loop forever

export function simulatePayoff(debts: Debt[], extraPerMonth: number, strategy: PayoffStrategy): PayoffSimResult {
    let working = debts.filter((d) => d.balance > 0).map((d) => ({
        id: d.id, name: d.name, balance: d.balance, monthlyRate: (d.aprPct || 0) / 100 / 12, minPayment: d.minPayment || 0,
    }));
    const payoffOrder: { debtId: string; name: string; monthPaidOff: number }[] = [];
    let totalInterestPaid = 0;
    let month = 0;
    let freedUpExtra = Math.max(0, extraPerMonth);

    while (working.length > 0 && month < MAX_SIM_MONTHS) {
        month++;
        for (const d of working) {
            const interest = d.balance * d.monthlyRate;
            totalInterestPaid += interest;
            d.balance += interest;
            d.balance -= Math.min(d.minPayment, d.balance);
        }

        const ordered = [...working].sort((a, b) => (strategy === 'avalanche' ? b.monthlyRate - a.monthlyRate : a.balance - b.balance));
        let remainingExtra = freedUpExtra;
        for (const d of ordered) {
            if (remainingExtra <= 0) break;
            const pay = Math.min(remainingExtra, d.balance);
            d.balance -= pay;
            remainingExtra -= pay;
        }

        const stillOwing: typeof working = [];
        for (const d of working) {
            if (d.balance <= 0.01) {
                payoffOrder.push({ debtId: d.id, name: d.name, monthPaidOff: month });
                freedUpExtra += d.minPayment; // paid-off minimum rolls into the next target -- the "snowball" effect
            } else {
                stillOwing.push(d);
            }
        }
        working = stillOwing;
    }

    return { months: month, totalInterestPaid, payoffOrder, hitCap: month >= MAX_SIM_MONTHS && working.length > 0 };
}

export interface StrategyComparison {
    avalanche: PayoffSimResult;
    snowball: PayoffSimResult;
    interestSavedAvalancheVsSnowball: number;
    monthsSavedAvalancheVsSnowball: number;
}

export function compareStrategies(debts: Debt[], extraPerMonth: number): StrategyComparison {
    const avalanche = simulatePayoff(debts, extraPerMonth, 'avalanche');
    const snowball = simulatePayoff(debts, extraPerMonth, 'snowball');
    return {
        avalanche, snowball,
        interestSavedAvalancheVsSnowball: snowball.totalInterestPaid - avalanche.totalInterestPaid,
        monthsSavedAvalancheVsSnowball: snowball.months - avalanche.months,
    };
}

export interface MortgageEquity {
    propertyValue: number;
    mortgageBalance: number;
    equity: number;
}

export function computeMortgageEquity(debts: Debt[], otherAssets: OtherAsset[]): MortgageEquity | null {
    const properties = otherAssets.filter((a) => a.type === 'property');
    const mortgages = debts.filter((d) => d.type === 'mortgage');
    if (properties.length === 0 && mortgages.length === 0) return null;
    const propertyValue = properties.reduce((s, a) => s + a.value, 0);
    const mortgageBalance = mortgages.reduce((s, d) => s + d.balance, 0);
    return { propertyValue, mortgageBalance, equity: propertyValue - mortgageBalance };
}
