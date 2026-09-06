import { Category } from '../types';

const EXPENSE_KEYWORDS: Record<string, string[]> = {
    Housing: ['rent', 'mortgage', 'landlord', 'housing'],
    Groceries: ['groceries', 'grocery', 'supermarket', 'market'],
    Transport: ['transport', 'uber', 'bolt', 'taxi', 'fuel', 'petrol', 'fare', 'bus'],
    Utilities: ['electricity', 'utility', 'utilities', 'phcn', 'nepa', 'water bill', 'light bill', 'internet bill', 'data bundle'],
    Education: ['school', 'tuition', 'education fees', 'textbook'],
    Healthcare: ['hospital', 'doctor', 'medicine', 'pharmacy', 'clinic'],
    'Dining Out': ['restaurant', 'lunch', 'dinner', 'breakfast', 'eatery', 'cafe', 'suya', 'takeout'],
    Entertainment: ['movie', 'cinema', 'game night', 'party', 'entertainment'],
    Subscriptions: ['subscription', 'netflix', 'spotify', 'dstv', 'gotv', 'prime video'],
    'Debt Payments': ['loan', 'debt', 'repayment', 'installment'],
    'Savings Transfer': ['savings', 'saved'],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
    Salary: ['salary', 'paycheck', 'wages'],
    Freelance: ['freelance', 'gig'],
    'Business Income': ['business income', 'sales', 'revenue'],
    'Investment Returns': ['dividend', 'interest earned', 'investment return'],
};

const EXPENSE_VERBS = ['spent', 'paid', 'bought', 'buy', 'purchase', 'cost', 'expense', 'gave'];
const INCOME_VERBS = ['received', 'earned', 'got paid', 'income', 'deposited', 'credited'];

function extractAmount(text: string): number | null {
    const regex = /([\d,]+(?:\.\d+)?)\s*(k|m)?\b/gi;
    let best: number | null = null;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        let value = parseFloat(match[1].replace(/,/g, ''));
        if (Number.isNaN(value)) continue;
        const suffix = match[2]?.toLowerCase();
        if (suffix === 'k') value *= 1_000;
        if (suffix === 'm') value *= 1_000_000;
        if (best === null || value > best) best = value;
    }
    return best;
}

export type QuickAddResult =
    | { ok: true; type: 'income' | 'expense'; amount: number; categoryId?: string; categoryLabel: string; description: string }
    | { ok: false; error: string };

export function parseQuickAddText(text: string, categories: Category[]): QuickAddResult {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: 'Type something first.' };

    const amount = extractAmount(trimmed);
    if (amount === null || amount <= 0) {
        return { ok: false, error: "Couldn't find an amount — try \"Spent 5000 on groceries\"." };
    }

    const lower = trimmed.toLowerCase();
    let type: 'income' | 'expense' = INCOME_VERBS.some((w) => lower.includes(w)) ? 'income' : 'expense';

    let categoryName: string | null = null;
    const primaryMap = type === 'income' ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;
    for (const [name, words] of Object.entries(primaryMap)) {
        if (words.some((w) => lower.includes(w))) { categoryName = name; break; }
    }
    if (!categoryName) {
        const otherMap = type === 'income' ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
        for (const [name, words] of Object.entries(otherMap)) {
            if (words.some((w) => lower.includes(w))) {
                categoryName = name;
                type = type === 'income' ? 'expense' : 'income';
                break;
            }
        }
    }
    if (!categoryName && EXPENSE_VERBS.some((w) => lower.includes(w))) type = 'expense';

    const fallbackName = type === 'income' ? 'Other Income' : 'Other';
    const matched = categories.find((c) => c.type === type && c.name.toLowerCase() === (categoryName || fallbackName).toLowerCase())
        || categories.find((c) => c.type === type && c.name.toLowerCase() === fallbackName.toLowerCase())
        || categories.find((c) => c.type === type);

    return {
        ok: true,
        type,
        amount,
        categoryId: matched?.id,
        categoryLabel: matched?.name || categoryName || fallbackName,
        description: trimmed,
    };
}
