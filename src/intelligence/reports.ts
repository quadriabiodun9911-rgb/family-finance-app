import { Category, FinancialGoal, Insight, RecurringBill, Transaction } from '../types';
import { addDaysISO, currentPeriod, daysRemainingInPeriod, shiftPeriod, todayISO } from '../utils/date';
import { transactionsInPeriod, sumByType, computeUpcomingBills, computeCashFlowSummary } from './cashFlow';
import { BudgetLine } from './budgetPlan';
import { computeAllCategoryTrends, generateSpendingInsights, topMovers } from './spending';
import { generateBudgetInsights } from './budgetPlan';
import { generateIncomeInsights } from './income';
import { IncomeSource } from '../types';
import { Account } from '../types';

export interface DailyPulse {
    dateLabel: string;
    yesterdayIncome: number;
    yesterdayExpense: number;
    yesterdayNet: number;
    monthIncome: number;
    monthExpense: number;
    monthSavings: number;
    budgetStatuses: { categoryName: string; status: 'good' | 'watch' | 'warning' }[];
    nextBill: { name: string; amount: number; daysAway: number } | null;
    suggestedDailySpendLimit: number;
    symbol: string;
}

export function buildDailyPulse(
    transactions: Transaction[], budgetLines: BudgetLine[], bills: RecurringBill[], symbol: string,
): DailyPulse {
    const yesterday = addDaysISO(todayISO(), -1);
    const yesterdayTx = transactions.filter((t) => t.date === yesterday);
    const yesterdayIncome = sumByType(yesterdayTx, 'income');
    const yesterdayExpense = sumByType(yesterdayTx, 'expense');
    const monthTx = transactionsInPeriod(transactions, currentPeriod());
    const monthIncome = sumByType(monthTx, 'income');
    const monthExpense = sumByType(monthTx, 'expense');

    const budgetStatuses = budgetLines.map((l) => ({
        categoryName: l.category.name,
        status: (l.paceStatus === 'over' ? 'warning' : l.paceStatus === 'watch' ? 'watch' : 'good') as 'good' | 'watch' | 'warning',
    }));

    const upcoming = computeUpcomingBills(bills, 7)[0];
    const nextBill = upcoming ? { name: upcoming.bill.name, amount: upcoming.bill.amount, daysAway: upcoming.daysAway } : null;

    const daysRemaining = Math.max(1, daysRemainingInPeriod(currentPeriod()));
    const remainingBudget = budgetLines.reduce((sum, l) => sum + Math.max(0, l.remaining), 0);
    const suggestedDailySpendLimit = budgetLines.length > 0 ? remainingBudget / daysRemaining : Math.max(0, (monthIncome - monthExpense) / daysRemaining);

    return {
        dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        yesterdayIncome, yesterdayExpense, yesterdayNet: yesterdayIncome - yesterdayExpense,
        monthIncome, monthExpense, monthSavings: Math.max(0, monthIncome - monthExpense),
        budgetStatuses, nextBill, suggestedDailySpendLimit, symbol,
    };
}

export interface WeeklyReview {
    weekIncome: number;
    weekExpense: number;
    weekSurplus: number;
    incomeChangePct: number | null;
    movers: { categoryName: string; changePct: number; direction: 'up' | 'down' }[];
    concerning: string | null;
    goingWell: string | null;
    recommendation: string;
    symbol: string;
}

export function buildWeeklyReview(transactions: Transaction[], categories: Category[], goals: FinancialGoal[], symbol: string): WeeklyReview {
    const today = todayISO();
    const weekStart = addDaysISO(today, -6);
    const priorWeekStart = addDaysISO(today, -13);
    const priorWeekEnd = addDaysISO(today, -7);

    const thisWeekTx = transactions.filter((t) => t.date >= weekStart && t.date <= today);
    const priorWeekTx = transactions.filter((t) => t.date >= priorWeekStart && t.date <= priorWeekEnd);

    const weekIncome = sumByType(thisWeekTx, 'income');
    const weekExpense = sumByType(thisWeekTx, 'expense');
    const priorIncome = sumByType(priorWeekTx, 'income');

    const incomeChangePct = priorIncome > 0 ? ((weekIncome - priorIncome) / priorIncome) * 100 : null;

    const movers: { categoryName: string; changePct: number; direction: 'up' | 'down' }[] = [];
    for (const cat of categories.filter((c) => c.type === 'expense')) {
        const thisTotal = thisWeekTx.filter((t) => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0);
        const priorTotal = priorWeekTx.filter((t) => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0);
        if (priorTotal === 0 && thisTotal === 0) continue;
        const changePct = priorTotal > 0 ? ((thisTotal - priorTotal) / priorTotal) * 100 : 100;
        if (Math.abs(changePct) >= 10) movers.push({ categoryName: cat.name, changePct, direction: changePct >= 0 ? 'up' : 'down' });
    }
    movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    const worstMover = movers.find((m) => m.direction === 'up');
    const concerning = worstMover ? `Your ${worstMover.categoryName.toLowerCase()} spending is trending ${worstMover.changePct.toFixed(0)}% above last week.` : null;

    const savingsGoals = goals.filter((g) => g.type === 'savings');
    const priorSavingsRate = priorIncome > 0 ? ((priorIncome - sumByType(priorWeekTx, 'expense')) / priorIncome) * 100 : null;
    const thisSavingsRate = weekIncome > 0 ? (weekIncome - weekExpense) / weekIncome * 100 : null;
    const goingWell = priorSavingsRate !== null && thisSavingsRate !== null && thisSavingsRate > priorSavingsRate
        ? `Your savings rate improved from ${priorSavingsRate.toFixed(0)}% to ${thisSavingsRate.toFixed(0)}% of income this week.`
        : (savingsGoals.length > 0 ? `Contributions are still landing toward ${savingsGoals[0].title}.` : null);

    const daysLeftInMonth = daysRemainingInPeriod(currentPeriod());
    const recommendation = daysLeftInMonth > 0
        ? `Keep discretionary spending in check for the rest of the month to stay on plan — review the Budget tab for the categories closest to their limit.`
        : `Month is closing out — check the Monthly Report for a full recap.`;

    return { weekIncome, weekExpense, weekSurplus: weekIncome - weekExpense, incomeChangePct, movers: movers.slice(0, 4), concerning, goingWell, recommendation, symbol };
}

export interface MonthlyReport {
    period: string;
    periodLabel: string;
    income: number;
    expense: number;
    savings: number;
    netCashFlow: number;
    biggestImprovement: string | null;
    biggestConcern: string | null;
    projectedAnnualSavings: number;
    recommendedActions: string[];
    symbol: string;
}

export function buildMonthlyReport(
    transactions: Transaction[], categories: Category[], incomeSources: IncomeSource[],
    budgetLines: BudgetLine[], symbol: string, period: string = currentPeriod(),
): MonthlyReport {
    const cf = computeCashFlowSummary(transactions, [] as Account[], [], period);
    const trends = computeAllCategoryTrends(transactions, categories);
    const movers = topMovers(trends, 4);

    const worsening = movers.find((m) => m.latestTotal > m.priorTotal);
    const improving = movers.find((m) => m.latestTotal < m.priorTotal && m.priorTotal > 0);

    const biggestConcern = worsening
        ? `${worsening.category.name} increased by ${symbol}${Math.round(worsening.latestTotal - worsening.priorTotal).toLocaleString()} compared to last month.`
        : null;
    const biggestImprovement = improving
        ? `${improving.category.name} decreased by ${symbol}${Math.round(improving.priorTotal - improving.latestTotal).toLocaleString()} compared to last month.`
        : (cf.surplus > 0 ? `Household generated a ${symbol}${Math.round(cf.surplus).toLocaleString()} surplus this month.` : null);

    const priorPeriods = [1, 2, 3].map((n) => shiftPeriod(period, -n));
    const priorSurplus = priorPeriods.map((p) => {
        const tx = transactionsInPeriod(transactions, p);
        return sumByType(tx, 'income') - sumByType(tx, 'expense');
    }).filter((_, i) => transactionsInPeriod(transactions, priorPeriods[i]).length > 0);
    const avgSurplus = priorSurplus.length ? [cf.surplus, ...priorSurplus].reduce((a, b) => a + b, 0) / (priorSurplus.length + 1) : cf.surplus;
    const projectedAnnualSavings = Math.max(0, avgSurplus) * 12;

    const budgetInsights = generateBudgetInsights(budgetLines, symbol);
    const spendingInsights = generateSpendingInsights(trends, symbol);
    const incomeInsights = generateIncomeInsights(transactions, incomeSources, symbol);
    const recommendedActions = [...budgetInsights, ...spendingInsights, ...incomeInsights]
        .filter((i: Insight) => i.severity !== 'good')
        .slice(0, 4)
        .map((i: Insight) => i.message);

    return {
        period, periodLabel: new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        income: cf.income, expense: cf.expense, savings: Math.max(0, cf.surplus), netCashFlow: cf.surplus,
        biggestImprovement, biggestConcern, projectedAnnualSavings, recommendedActions, symbol,
    };
}
