import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
    Household, HouseholdMember, Category, Account, IncomeSource, Transaction,
    RecurringBill, Budget, FinancialGoal, GoalContribution, Investment, Debt, OtherAsset, NetWorthSnapshot,
} from '../types';
import { loadJSON, saveJSON, StorageKeys } from '../utils/storage';
import { defaultCategories, defaultOwnerMember } from '../utils/defaultData';
import { generateId } from '../utils/id';
import { todayISO } from '../utils/date';

interface FinanceContextValue {
    isLoading: boolean;
    isOnboarded: boolean;
    household: Household | null;
    members: HouseholdMember[];
    categories: Category[];
    accounts: Account[];
    incomeSources: IncomeSource[];
    transactions: Transaction[];
    recurringBills: RecurringBill[];
    budgets: Budget[];
    goals: FinancialGoal[];
    investments: Investment[];
    debts: Debt[];
    otherAssets: OtherAsset[];
    netWorthHistory: NetWorthSnapshot[];

    completeOnboarding: (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string) => Promise<void>;

    addMember: (m: Omit<HouseholdMember, 'id' | 'createdAt'>) => void;
    removeMember: (id: string) => void;

    addCategory: (c: Omit<Category, 'id'>) => void;
    updateCategory: (id: string, patch: Partial<Category>) => void;
    removeCategory: (id: string) => void;

    addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => void;
    updateAccount: (id: string, patch: Partial<Account>) => void;
    removeAccount: (id: string) => void;

    addIncomeSource: (s: Omit<IncomeSource, 'id' | 'createdAt'>) => void;
    removeIncomeSource: (id: string) => void;

    addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
    updateTransaction: (id: string, patch: Partial<Transaction>) => void;
    removeTransaction: (id: string) => void;

    addRecurringBill: (b: Omit<RecurringBill, 'id' | 'createdAt'>) => void;
    removeRecurringBill: (id: string) => void;

    setBudget: (categoryId: string, period: string, planned: number) => void;

    addGoal: (g: Omit<FinancialGoal, 'id' | 'createdAt' | 'contributions'>) => void;
    updateGoal: (id: string, patch: Partial<FinancialGoal>) => void;
    removeGoal: (id: string) => void;
    contributeToGoal: (id: string, amount: number, note?: string) => void;

    addInvestment: (i: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateInvestment: (id: string, patch: Partial<Investment>) => void;
    removeInvestment: (id: string) => void;

    addDebt: (d: Omit<Debt, 'id' | 'createdAt'>) => void;
    updateDebt: (id: string, patch: Partial<Debt>) => void;
    removeDebt: (id: string) => void;

    addOtherAsset: (a: Omit<OtherAsset, 'id' | 'createdAt'>) => void;
    removeOtherAsset: (id: string) => void;

    recordNetWorthSnapshot: (totalAssets: number, totalLiabilities: number) => void;
}

const FinanceContext = createContext<FinanceContextValue | undefined>(undefined);

function useCollection<T extends { id: string }>(key: string, initial: T[] = []) {
    const [items, setItems] = useState<T[]>(initial);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadJSON<T[]>(key, initial).then((v) => {
            setItems(v);
            setLoaded(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (loaded) saveJSON(key, items);
    }, [items, loaded, key]);

    return [items, setItems, loaded] as const;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [household, setHousehold] = useState<Household | null>(null);

    const [members, setMembers] = useCollection<HouseholdMember>(StorageKeys.members);
    const [categories, setCategories] = useCollection<Category>(StorageKeys.categories);
    const [accounts, setAccounts] = useCollection<Account>(StorageKeys.accounts);
    const [incomeSources, setIncomeSources] = useCollection<IncomeSource>(StorageKeys.incomeSources);
    const [transactions, setTransactions] = useCollection<Transaction>(StorageKeys.transactions);
    const [recurringBills, setRecurringBills] = useCollection<RecurringBill>(StorageKeys.recurringBills);
    const [budgets, setBudgets] = useCollection<Budget>(StorageKeys.budgets);
    const [goals, setGoals] = useCollection<FinancialGoal>(StorageKeys.goals);
    const [investments, setInvestments] = useCollection<Investment>(StorageKeys.investments);
    const [debts, setDebts] = useCollection<Debt>(StorageKeys.debts);
    const [otherAssets, setOtherAssets] = useCollection<OtherAsset>(StorageKeys.otherAssets);
    const [netWorthHistory, setNetWorthHistory] = useCollection<NetWorthSnapshot>(StorageKeys.netWorthHistory);

    useEffect(() => {
        (async () => {
            const savedHousehold = await loadJSON<Household | null>(StorageKeys.household, null);
            const onboarded = await loadJSON<boolean>(StorageKeys.onboarded, false);
            setHousehold(savedHousehold);
            setIsOnboarded(onboarded);
            setIsLoading(false);
        })();
    }, []);

    const completeOnboarding = useCallback(async (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string) => {
        const h: Household = { name: householdName, currencyCode, currencySymbol, createdAt: new Date().toISOString() };
        setHousehold(h);
        setMembers([defaultOwnerMember(ownerName)]);
        setCategories(defaultCategories());
        setIsOnboarded(true);
        await saveJSON(StorageKeys.household, h);
        await saveJSON(StorageKeys.onboarded, true);
    }, [setMembers, setCategories]);

    // ─── Members ────────────────────────────────────────────────────────────
    const addMember = useCallback((m: Omit<HouseholdMember, 'id' | 'createdAt'>) => {
        setMembers((prev) => [...prev, { ...m, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setMembers]);
    const removeMember = useCallback((id: string) => setMembers((prev) => prev.filter((m) => m.id !== id)), [setMembers]);

    // ─── Categories ─────────────────────────────────────────────────────────
    const addCategory = useCallback((c: Omit<Category, 'id'>) => {
        setCategories((prev) => [...prev, { ...c, id: generateId() }]);
    }, [setCategories]);
    const updateCategory = useCallback((id: string, patch: Partial<Category>) => {
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }, [setCategories]);
    const removeCategory = useCallback((id: string) => setCategories((prev) => prev.filter((c) => c.id !== id)), [setCategories]);

    // ─── Accounts ───────────────────────────────────────────────────────────
    const addAccount = useCallback((a: Omit<Account, 'id' | 'createdAt'>) => {
        setAccounts((prev) => [...prev, { ...a, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setAccounts]);
    const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
        setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    }, [setAccounts]);
    const removeAccount = useCallback((id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id)), [setAccounts]);

    // ─── Income sources ─────────────────────────────────────────────────────
    const addIncomeSource = useCallback((s: Omit<IncomeSource, 'id' | 'createdAt'>) => {
        setIncomeSources((prev) => [...prev, { ...s, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setIncomeSources]);
    const removeIncomeSource = useCallback((id: string) => setIncomeSources((prev) => prev.filter((s) => s.id !== id)), [setIncomeSources]);

    // ─── Transactions ───────────────────────────────────────────────────────
    const addTransaction = useCallback((t: Omit<Transaction, 'id' | 'createdAt'>) => {
        setTransactions((prev) => [{ ...t, id: generateId(), createdAt: new Date().toISOString() }, ...prev]);
    }, [setTransactions]);
    const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    }, [setTransactions]);
    const removeTransaction = useCallback((id: string) => setTransactions((prev) => prev.filter((t) => t.id !== id)), [setTransactions]);

    // ─── Recurring bills ────────────────────────────────────────────────────
    const addRecurringBill = useCallback((b: Omit<RecurringBill, 'id' | 'createdAt'>) => {
        setRecurringBills((prev) => [...prev, { ...b, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setRecurringBills]);
    const removeRecurringBill = useCallback((id: string) => setRecurringBills((prev) => prev.filter((b) => b.id !== id)), [setRecurringBills]);

    // ─── Budgets ────────────────────────────────────────────────────────────
    const setBudget = useCallback((categoryId: string, period: string, planned: number) => {
        setBudgets((prev) => {
            const existing = prev.find((b) => b.categoryId === categoryId && b.period === period);
            if (existing) return prev.map((b) => (b.id === existing.id ? { ...b, planned } : b));
            return [...prev, { id: generateId(), categoryId, period, planned }];
        });
    }, [setBudgets]);

    // ─── Goals ──────────────────────────────────────────────────────────────
    const addGoal = useCallback((g: Omit<FinancialGoal, 'id' | 'createdAt' | 'contributions'>) => {
        setGoals((prev) => [...prev, { ...g, id: generateId(), createdAt: new Date().toISOString(), contributions: [] }]);
    }, [setGoals]);
    const updateGoal = useCallback((id: string, patch: Partial<FinancialGoal>) => {
        setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    }, [setGoals]);
    const removeGoal = useCallback((id: string) => setGoals((prev) => prev.filter((g) => g.id !== id)), [setGoals]);
    const contributeToGoal = useCallback((id: string, amount: number, note?: string) => {
        const contribution: GoalContribution = { id: generateId(), date: todayISO(), amount, note };
        setGoals((prev) => prev.map((g) => (g.id === id
            ? { ...g, currentValue: g.currentValue + amount, contributions: [contribution, ...g.contributions] }
            : g)));
    }, [setGoals]);

    // ─── Investments ────────────────────────────────────────────────────────
    const addInvestment = useCallback((i: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => {
        const now = new Date().toISOString();
        setInvestments((prev) => [...prev, { ...i, id: generateId(), createdAt: now, updatedAt: now }]);
    }, [setInvestments]);
    const updateInvestment = useCallback((id: string, patch: Partial<Investment>) => {
        setInvestments((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)));
    }, [setInvestments]);
    const removeInvestment = useCallback((id: string) => setInvestments((prev) => prev.filter((i) => i.id !== id)), [setInvestments]);

    // ─── Debts ──────────────────────────────────────────────────────────────
    const addDebt = useCallback((d: Omit<Debt, 'id' | 'createdAt'>) => {
        setDebts((prev) => [...prev, { ...d, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setDebts]);
    const updateDebt = useCallback((id: string, patch: Partial<Debt>) => {
        setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    }, [setDebts]);
    const removeDebt = useCallback((id: string) => setDebts((prev) => prev.filter((d) => d.id !== id)), [setDebts]);

    // ─── Other assets ───────────────────────────────────────────────────────
    const addOtherAsset = useCallback((a: Omit<OtherAsset, 'id' | 'createdAt'>) => {
        setOtherAssets((prev) => [...prev, { ...a, id: generateId(), createdAt: new Date().toISOString() }]);
    }, [setOtherAssets]);
    const removeOtherAsset = useCallback((id: string) => setOtherAssets((prev) => prev.filter((a) => a.id !== id)), [setOtherAssets]);

    // ─── Net worth history ──────────────────────────────────────────────────
    const recordNetWorthSnapshot = useCallback((totalAssets: number, totalLiabilities: number) => {
        const today = todayISO();
        const period = today.slice(0, 7);
        setNetWorthHistory((prev) => {
            const withoutThisMonth = prev.filter((s) => s.date.slice(0, 7) !== period);
            return [...withoutThisMonth, {
                id: generateId(), date: today, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities,
            }].sort((a, b) => a.date.localeCompare(b.date));
        });
    }, [setNetWorthHistory]);

    const value = useMemo<FinanceContextValue>(() => ({
        isLoading, isOnboarded, household, members, categories, accounts, incomeSources,
        transactions, recurringBills, budgets, goals, investments, debts, otherAssets, netWorthHistory,
        completeOnboarding,
        addMember, removeMember,
        addCategory, updateCategory, removeCategory,
        addAccount, updateAccount, removeAccount,
        addIncomeSource, removeIncomeSource,
        addTransaction, updateTransaction, removeTransaction,
        addRecurringBill, removeRecurringBill,
        setBudget,
        addGoal, updateGoal, removeGoal, contributeToGoal,
        addInvestment, updateInvestment, removeInvestment,
        addDebt, updateDebt, removeDebt,
        addOtherAsset, removeOtherAsset,
        recordNetWorthSnapshot,
    }), [
        isLoading, isOnboarded, household, members, categories, accounts, incomeSources,
        transactions, recurringBills, budgets, goals, investments, debts, otherAssets, netWorthHistory,
        completeOnboarding, addMember, removeMember, addCategory, updateCategory, removeCategory,
        addAccount, updateAccount, removeAccount, addIncomeSource, removeIncomeSource,
        addTransaction, updateTransaction, removeTransaction, addRecurringBill, removeRecurringBill,
        setBudget, addGoal, updateGoal, removeGoal, contributeToGoal,
        addInvestment, updateInvestment, removeInvestment, addDebt, updateDebt, removeDebt,
        addOtherAsset, removeOtherAsset, recordNetWorthSnapshot,
    ]);

    return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
    const ctx = useContext(FinanceContext);
    if (!ctx) throw new Error('useFinance must be used within a FinanceProvider');
    return ctx;
}
