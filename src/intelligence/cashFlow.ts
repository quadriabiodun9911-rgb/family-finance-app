import { Account, RecurringBill, Transaction } from '../types';
import { currentPeriod, shiftPeriod, todayISO, daysBetween } from '../utils/date';

export interface UpcomingBill {
    bill: RecurringBill;
    dueDate: string;
    daysAway: number;
}

export interface CashFlowSummary {
    period: string;
    income: number;
    expense: number;
    surplus: number;
    accountsBalance: number;
    upcomingBills: UpcomingBill[];
    committedNextMonth: number;
    discretionaryCash: number;
    forecastNextPeriodSurplus: number;
}

export function transactionsInPeriod(transactions: Transaction[], period: string): Transaction[] {
    return transactions.filter((t) => t.date.slice(0, 7) === period);
}

export function sumByType(transactions: Transaction[], type: 'income' | 'expense'): number {
    return transactions.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
}

function nextDueDate(dueDay: number, fromISO: string): string {
    const from = new Date(fromISO + 'T00:00:00');
    const candidate = new Date(from.getFullYear(), from.getMonth(), Math.min(dueDay, 28));
    if (candidate.getTime() < from.setHours(0, 0, 0, 0)) candidate.setMonth(candidate.getMonth() + 1);
    return candidate.toISOString().slice(0, 10);
}

export function computeUpcomingBills(bills: RecurringBill[], withinDays = 14): UpcomingBill[] {
    const today = todayISO();
    return bills
        .filter((b) => b.active)
        .map((bill) => {
            const dueDate = nextDueDate(bill.dueDay, today);
            return { bill, dueDate, daysAway: daysBetween(today, dueDate) };
        })
        .filter((u) => u.daysAway <= withinDays)
        .sort((a, b) => a.daysAway - b.daysAway);
}

export function computeCashFlowSummary(
    transactions: Transaction[],
    accounts: Account[],
    bills: RecurringBill[],
    period: string = currentPeriod(),
): CashFlowSummary {
    const periodTx = transactionsInPeriod(transactions, period);
    const income = sumByType(periodTx, 'income');
    const expense = sumByType(periodTx, 'expense');
    const accountsBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const upcomingBills = computeUpcomingBills(bills, 14);
    const committedNextMonth = bills.filter((b) => b.active).reduce((sum, b) => sum + b.amount, 0);

    const priorPeriods = [1, 2, 3].map((n) => shiftPeriod(period, -n));
    const priorSurpluses = priorPeriods.map((p) => {
        const tx = transactionsInPeriod(transactions, p);
        return sumByType(tx, 'income') - sumByType(tx, 'expense');
    });
    const validPrior = priorSurpluses.filter((_, i) => transactionsInPeriod(transactions, priorPeriods[i]).length > 0);
    const forecastNextPeriodSurplus = validPrior.length
        ? validPrior.reduce((a, b) => a + b, 0) / validPrior.length
        : income - expense;

    return {
        period,
        income,
        expense,
        surplus: income - expense,
        accountsBalance,
        upcomingBills,
        committedNextMonth,
        discretionaryCash: Math.max(0, accountsBalance - committedNextMonth),
        forecastNextPeriodSurplus,
    };
}
