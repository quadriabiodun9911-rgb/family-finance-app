import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'family-finance:';

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
    try {
        const raw = await AsyncStorage.getItem(PREFIX + key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
    try {
        await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // best-effort local persistence -- a failed write here shouldn't crash the app
    }
}

export const StorageKeys = {
    household: 'household',
    members: 'members',
    categories: 'categories',
    accounts: 'accounts',
    incomeSources: 'incomeSources',
    transactions: 'transactions',
    recurringBills: 'recurringBills',
    budgets: 'budgets',
    goals: 'goals',
    investments: 'investments',
    debts: 'debts',
    otherAssets: 'otherAssets',
    netWorthHistory: 'netWorthHistory',
    onboarded: 'onboarded',
} as const;
