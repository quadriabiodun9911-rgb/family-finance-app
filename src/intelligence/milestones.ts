import { Account, Debt, FinancialGoal, NetWorthSnapshot, Transaction } from '../types';
import { averageMonthlyExpense } from './risk';

export interface MilestoneCandidate {
    key: string; // stable id -- once recorded in milestones_seen it never fires again
    icon: string; // Ionicons name
    title: string;
    message: string;
}

const STREAK_MILESTONES = [7, 30, 100, 365];
const EMERGENCY_FUND_MILESTONES = [1, 3, 6];

// Everything a household could currently celebrate -- callers diff this
// against already-seen keys to find what's actually new.
export function detectMilestones(
    goals: FinancialGoal[],
    debts: Debt[],
    netWorthHistory: NetWorthSnapshot[],
    currentStreak: number,
    accounts: Account[],
    transactions: Transaction[],
): MilestoneCandidate[] {
    const found: MilestoneCandidate[] = [];

    for (const g of goals) {
        if (g.targetValue > 0 && g.currentValue >= g.targetValue) {
            found.push({
                key: `goal-complete-${g.id}`,
                icon: 'trophy',
                title: 'Goal reached!',
                message: `You hit your "${g.title}" goal. Time to set the next one.`,
            });
        }
    }

    for (const d of debts) {
        if (d.balance <= 0 && (d.originalPrincipal ?? 0) > 0) {
            found.push({
                key: `debt-paid-${d.id}`,
                icon: 'ribbon',
                title: 'Debt paid off!',
                message: `You've fully paid off "${d.name}". One less thing pulling at your income every month.`,
            });
        }
    }

    for (const s of STREAK_MILESTONES) {
        if (currentStreak >= s) {
            found.push({
                key: `streak-${s}`,
                icon: 'flame',
                title: `${s}-day streak!`,
                message: `You've checked in ${s} days in a row. Consistency is most of what makes this work.`,
            });
        }
    }

    const liquidCash = accounts.reduce((sum, a) => sum + a.balance, 0);
    const avgExpense = averageMonthlyExpense(transactions, 3);
    const emergencyFundMonths = avgExpense > 0 ? liquidCash / avgExpense : (liquidCash > 0 ? 99 : 0);
    for (const m of EMERGENCY_FUND_MILESTONES) {
        if (emergencyFundMonths >= m) {
            found.push({
                key: `emergency-fund-${m}`,
                icon: 'shield-checkmark',
                title: `${m}-month emergency fund`,
                message: `Your cash on hand now covers ${m} month${m > 1 ? 's' : ''} of expenses.`,
            });
        }
    }

    if (netWorthHistory.length >= 2) {
        const sorted = [...netWorthHistory].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const prior = sorted[sorted.length - 2];
        if (prior.netWorth <= 0 && latest.netWorth > 0) {
            found.push({
                key: 'networth-positive',
                icon: 'trending-up',
                title: 'Net worth turned positive!',
                message: "Your household's assets now outweigh its liabilities for the first time.",
            });
        }
    }

    return found;
}
