import { Category } from '../types';

// No `id` here -- these get inserted straight into Supabase at household
// creation (see FinanceContext.createHousehold), and the `categories` table
// generates its own uuid primary key. A client-generated id would collide
// with the column's `uuid` type.
export function defaultCategories(): Array<Omit<Category, 'id'>> {
    const expense: Array<[string, string, string, number?, Category['jar']?]> = [
        ['Housing', 'home', '#60a5fa', undefined, undefined],
        ['Groceries', 'cart', '#34d399', undefined, undefined],
        ['Transport', 'car', '#fbbf24', undefined, undefined],
        ['Utilities', 'flash', '#f472b6', undefined, undefined],
        ['Education', 'school', '#a78bfa', undefined, undefined],
        ['Healthcare', 'medkit', '#f87171', undefined, undefined],
        ['Dining Out', 'restaurant', '#fb923c', undefined, undefined],
        ['Entertainment', 'film', '#38bdf8', undefined, undefined],
        ['Subscriptions', 'repeat', '#c084fc', undefined, undefined],
        ['Debt Payments', 'card', '#ef4444', undefined, undefined],
        ['Savings Transfer', 'wallet', '#22c55e', undefined, 'savings'],
        ['Emergency Fund', 'shield-checkmark', '#facc15', undefined, 'emergency'],
        ['Other', 'ellipsis-horizontal', '#94a3b8', undefined, undefined],
    ];
    const income: Array<[string, string, string]> = [
        ['Salary', 'briefcase', '#22c55e'],
        ['Freelance', 'laptop', '#38bdf8'],
        ['Business Income', 'storefront', '#fbbf24'],
        ['Investment Returns', 'trending-up', '#a78bfa'],
        ['Other Income', 'add-circle', '#94a3b8'],
    ];
    return [
        ...expense.map(([name, icon, color, target, jar]) => ({
            name, type: 'expense' as const, icon, color, monthlyTarget: target, jar, isDefault: true,
        })),
        ...income.map(([name, icon, color]) => ({
            name, type: 'income' as const, icon, color, isDefault: true,
        })),
    ];
}
