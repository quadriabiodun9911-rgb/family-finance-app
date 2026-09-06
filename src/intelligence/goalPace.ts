import { FinancialGoal } from '../types';
import { todayISO, monthsBetween, shiftPeriod, currentPeriod } from '../utils/date';

export interface GoalPace {
    goal: FinancialGoal;
    progressPct: number;
    distanceToTarget: number;
    monthlyRate: number; // average monthly contribution over recent history, magnitude toward target
    monthsToDeadline: number | null;
    requiredMonthlyRate: number | null;
    onTrack: boolean | null; // null when there's no deadline to judge against
    projectedMonthsToComplete: number | null;
    narrative: string;
}

function recentMonthlyRate(goal: FinancialGoal): number {
    if (goal.contributions.length === 0) return 0;
    const periods = new Set<string>();
    const byPeriod = new Map<string, number>();
    for (const c of goal.contributions) {
        const p = c.date.slice(0, 7);
        periods.add(p);
        byPeriod.set(p, (byPeriod.get(p) || 0) + Math.abs(c.amount));
    }
    const last6 = [0, 1, 2, 3, 4, 5].map((n) => shiftPeriod(currentPeriod(), -n));
    const relevant = last6.filter((p) => periods.has(p));
    if (relevant.length === 0) return 0;
    const total = relevant.reduce((sum, p) => sum + (byPeriod.get(p) || 0), 0);
    return total / relevant.length;
}

export function computeGoalPace(goal: FinancialGoal, symbol: string): GoalPace {
    const distanceToTarget = Math.max(0, Math.abs(goal.targetValue - goal.currentValue));
    const totalSpan = Math.abs(goal.targetValue - (goal.currentValue - (goal.contributions.reduce((s, c) => s + c.amount, 0)))) || Math.abs(goal.targetValue) || 1;
    const progressPct = Math.max(0, Math.min(100, 100 - (distanceToTarget / totalSpan) * 100));
    const monthlyRate = recentMonthlyRate(goal);

    let monthsToDeadline: number | null = null;
    let requiredMonthlyRate: number | null = null;
    let onTrack: boolean | null = null;
    if (goal.deadline) {
        monthsToDeadline = Math.max(0, monthsBetween(todayISO(), goal.deadline));
        requiredMonthlyRate = monthsToDeadline > 0 ? distanceToTarget / monthsToDeadline : distanceToTarget;
        onTrack = monthlyRate >= requiredMonthlyRate * 0.97;
    }

    const projectedMonthsToComplete = monthlyRate > 0 ? Math.ceil(distanceToTarget / monthlyRate) : null;

    let narrative: string;
    if (distanceToTarget === 0) {
        narrative = `${goal.title} is complete.`;
    } else if (monthlyRate === 0) {
        narrative = `No contributions logged recently toward ${goal.title}. At ${symbol}0/month this goal won't move.`;
    } else if (goal.deadline && requiredMonthlyRate !== null && monthsToDeadline !== null) {
        if (onTrack) {
            narrative = `On track — at your current pace of ${symbol}${Math.round(monthlyRate).toLocaleString()}/month, you'll reach ${goal.title} on or before your deadline.`;
        } else {
            const shortfall = Math.max(0, requiredMonthlyRate - monthlyRate);
            const projectedExtraMonths = monthlyRate > 0 ? Math.max(0, Math.ceil(distanceToTarget / monthlyRate) - monthsToDeadline) : null;
            narrative = projectedExtraMonths
                ? `At your current pace, you'll reach ${goal.title} approximately ${projectedExtraMonths} month${projectedExtraMonths === 1 ? '' : 's'} late. Increasing monthly contributions by ${symbol}${Math.round(shortfall).toLocaleString()} would put you back on schedule.`
                : `At your current pace, ${goal.title} is behind schedule. Increasing monthly contributions by ${symbol}${Math.round(shortfall).toLocaleString()} would put you back on schedule.`;
        }
    } else if (projectedMonthsToComplete !== null) {
        narrative = `At ${symbol}${Math.round(monthlyRate).toLocaleString()}/month, you're projected to reach ${goal.title} in about ${projectedMonthsToComplete} month${projectedMonthsToComplete === 1 ? '' : 's'}.`;
    } else {
        narrative = `${goal.title} is ${progressPct.toFixed(0)}% complete.`;
    }

    return { goal, progressPct, distanceToTarget, monthlyRate, monthsToDeadline, requiredMonthlyRate, onTrack, projectedMonthsToComplete, narrative };
}

export function computeAllGoalPaces(goals: FinancialGoal[], symbol: string): GoalPace[] {
    return goals.map((g) => computeGoalPace(g, symbol));
}
