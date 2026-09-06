import { Category, HouseholdMember } from '../types';
import { generateId } from './id';

export function defaultCategories(): Category[] {
    const expense: Array<[string, string, string, number?]> = [
        ['Housing', 'home', '#60a5fa', undefined],
        ['Groceries', 'cart', '#34d399', undefined],
        ['Transport', 'car', '#fbbf24', undefined],
        ['Utilities', 'flash', '#f472b6', undefined],
        ['Education', 'school', '#a78bfa', undefined],
        ['Healthcare', 'medkit', '#f87171', undefined],
        ['Dining Out', 'restaurant', '#fb923c', undefined],
        ['Entertainment', 'film', '#38bdf8', undefined],
        ['Subscriptions', 'repeat', '#c084fc', undefined],
        ['Debt Payments', 'card', '#ef4444', undefined],
        ['Savings Transfer', 'wallet', '#22c55e', undefined],
        ['Other', 'ellipsis-horizontal', '#94a3b8', undefined],
    ];
    const income: Array<[string, string, string]> = [
        ['Salary', 'briefcase', '#22c55e'],
        ['Freelance', 'laptop', '#38bdf8'],
        ['Business Income', 'storefront', '#fbbf24'],
        ['Investment Returns', 'trending-up', '#a78bfa'],
        ['Other Income', 'add-circle', '#94a3b8'],
    ];
    return [
        ...expense.map(([name, icon, color, target]) => ({
            id: generateId(), name, type: 'expense' as const, icon, color, monthlyTarget: target, isDefault: true,
        })),
        ...income.map(([name, icon, color]) => ({
            id: generateId(), name, type: 'income' as const, icon, color, isDefault: true,
        })),
    ];
}

export function defaultOwnerMember(name: string): HouseholdMember {
    return {
        id: generateId(),
        name,
        role: 'owner',
        permission: 'full',
        color: '#3b82f6',
        createdAt: new Date().toISOString(),
    };
}
