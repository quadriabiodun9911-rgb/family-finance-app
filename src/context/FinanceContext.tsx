import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
    Household, HouseholdMember, HouseholdInvite, Category, Account, IncomeSource, Transaction,
    RecurringBill, Budget, FinancialGoal, GoalContribution, Investment, Debt, OtherAsset, NetWorthSnapshot,
    MemberRole, MemberPermission,
} from '../types';
import { supabase } from '../utils/supabaseClient';
import { fetchAll, insertRow, updateRow, deleteRow } from '../utils/db';
import { toCamelCase, toSnakeCase } from '../utils/caseConvert';
import { defaultCategories } from '../utils/defaultData';
import { todayISO, currentPeriod, addDaysISO } from '../utils/date';
import { useAuth } from './AuthContext';
import { Colors } from '../theme/colors';
import { uploadReceiptImage } from '../utils/receiptStorage';

interface FinanceContextValue {
    isLoading: boolean;
    isOnboarded: boolean; // has a household
    household: Household | null;
    members: HouseholdMember[];
    myMemberId: string | null;
    myPermission: MemberPermission | null;
    pendingInvites: HouseholdInvite[];
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
    seenMilestoneKeys: string[];
    recordMilestones: (keys: string[]) => Promise<void>;

    createHousehold: (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string) => Promise<{ error: string | null }>;
    createSampleHousehold: () => Promise<{ error: string | null }>;
    joinHousehold: (inviteCode: string, memberName: string) => Promise<{ error: string | null }>;
    inviteMember: (email: string, role: MemberRole, permission: MemberPermission) => Promise<{ code: string | null; error: string | null }>;
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
    bulkAddTransactions: (rows: Array<Omit<Transaction, 'id' | 'createdAt'>>) => Promise<{ error: string | null; count: number }>;
    uploadReceiptForTransaction: (transactionId: string, localUri: string) => Promise<{ error: string | null }>;
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

function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Generic CRUD bound to one table + its React state setter -- covers every
// household-scoped collection that doesn't need bespoke logic (goals and
// budgets are handled separately: goals carry a nested contributions array,
// budgets need upsert-by-period semantics).
function makeCrud<T extends { id: string }>(table: string, householdId: string | undefined, setState: React.Dispatch<React.SetStateAction<T[]>>) {
    return {
        add: (extra: Record<string, unknown>) => {
            if (!householdId) return;
            insertRow<T>(table, { ...extra, householdId }).then((created) => {
                setState((prev) => [created, ...prev]);
            }).catch((e) => console.warn(`${table} insert failed`, e.message));
        },
        update: (id: string, patch: Record<string, unknown>) => {
            updateRow(table, id, patch).then(() => {
                setState((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } as T : item)));
            }).catch((e) => console.warn(`${table} update failed`, e.message));
        },
        remove: (id: string) => {
            deleteRow(table, id).then(() => {
                setState((prev) => prev.filter((item) => item.id !== id));
            }).catch((e) => console.warn(`${table} delete failed`, e.message));
        },
    };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [household, setHousehold] = useState<Household | null>(null);
    const [myMemberId, setMyMemberId] = useState<string | null>(null);
    const [myPermission, setMyPermission] = useState<MemberPermission | null>(null);
    const [members, setMembers] = useState<HouseholdMember[]>([]);
    const [pendingInvites, setPendingInvites] = useState<HouseholdInvite[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [goals, setGoals] = useState<FinancialGoal[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [otherAssets, setOtherAssets] = useState<OtherAsset[]>([]);
    const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([]);
    const [seenMilestoneKeys, setSeenMilestoneKeys] = useState<string[]>([]);

    const loadEverything = useCallback(async (hh: Household, memberId: string, permission: MemberPermission) => {
        const [
            membersRows, invitesRows, categoriesRows, accountsRows, incomeSourcesRows,
            transactionsRows, recurringBillsRows, budgetsRows, goalsRows, investmentsRows,
            debtsRows, otherAssetsRows, netWorthRows, milestonesRows,
        ] = await Promise.all([
            fetchAll<HouseholdMember>('household_members', hh.id),
            fetchAll<HouseholdInvite>('household_invites', hh.id).catch(() => [] as HouseholdInvite[]),
            fetchAll<Category>('categories', hh.id),
            fetchAll<Account>('accounts', hh.id),
            fetchAll<IncomeSource>('income_sources', hh.id),
            fetchAll<Transaction>('transactions', hh.id, { column: 'date', ascending: false }),
            fetchAll<RecurringBill>('recurring_bills', hh.id),
            fetchAll<Budget>('budgets', hh.id),
            fetchAll<Omit<FinancialGoal, 'contributions'>>('goals', hh.id),
            fetchAll<Investment>('investments', hh.id),
            fetchAll<Debt>('debts', hh.id),
            fetchAll<OtherAsset>('other_assets', hh.id),
            fetchAll<NetWorthSnapshot>('net_worth_snapshots', hh.id, { column: 'date', ascending: true }),
            fetchAll<{ key: string }>('milestones_seen', hh.id).catch(() => [] as { key: string }[]),
        ]);

        const goalIds = goalsRows.map((g) => g.id);
        let contributionsByGoal = new Map<string, GoalContribution[]>();
        if (goalIds.length > 0) {
            const { data, error } = await supabase.from('goal_contributions').select('*').in('goal_id', goalIds).order('date', { ascending: false });
            if (!error && data) {
                for (const row of data) {
                    const c = toCamelCase<GoalContribution & { goalId: string }>(row);
                    const list = contributionsByGoal.get(c.goalId) || [];
                    list.push(c);
                    contributionsByGoal.set(c.goalId, list);
                }
            }
        }
        const goalsWithContributions: FinancialGoal[] = goalsRows.map((g) => ({
            ...g, contributions: contributionsByGoal.get(g.id) || [],
        }));

        // Daily check-in streak: bump it the first time this member loads the
        // app on a given calendar day. Best-effort -- a failed write here
        // shouldn't block anything else from loading.
        const today = todayISO();
        const selfIdx = membersRows.findIndex((m) => m.id === memberId);
        if (selfIdx !== -1 && membersRows[selfIdx].lastActiveDate !== today) {
            const self = membersRows[selfIdx];
            const yesterday = addDaysISO(today, -1);
            const newStreak = self.lastActiveDate === yesterday ? (self.currentStreak || 0) + 1 : 1;
            const newLongest = Math.max(self.longestStreak || 0, newStreak);
            updateRow('household_members', memberId, { currentStreak: newStreak, longestStreak: newLongest, lastActiveDate: today })
                .catch((e) => console.warn('streak check-in failed', e.message));
            membersRows[selfIdx] = { ...self, currentStreak: newStreak, longestStreak: newLongest, lastActiveDate: today };
        }

        setMembers(membersRows);
        setSeenMilestoneKeys(milestonesRows.map((m) => m.key));
        setPendingInvites(invitesRows.filter((i) => i.status === 'pending'));
        setCategories(categoriesRows);
        setAccounts(accountsRows);
        setIncomeSources(incomeSourcesRows);
        setTransactions(transactionsRows);
        setRecurringBills(recurringBillsRows);
        setBudgets(budgetsRows);
        setGoals(goalsWithContributions);
        setInvestments(investmentsRows);
        setDebts(debtsRows);
        setOtherAssets(otherAssetsRows);
        setNetWorthHistory(netWorthRows);
        setHousehold(hh);
        setMyMemberId(memberId);
        setMyPermission(permission);
    }, []);

    const bootstrap = useCallback(async () => {
        if (!user) {
            setHousehold(null); setMyMemberId(null); setMyPermission(null);
            setMembers([]); setPendingInvites([]); setCategories([]); setAccounts([]); setIncomeSources([]);
            setTransactions([]); setRecurringBills([]); setBudgets([]); setGoals([]); setInvestments([]);
            setDebts([]); setOtherAssets([]); setNetWorthHistory([]); setSeenMilestoneKeys([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const { data: memberRow, error: memberErr } = await supabase
            .from('household_members').select('*').eq('user_id', user.id).limit(1).maybeSingle();
        if (memberErr || !memberRow) {
            setHousehold(null);
            setIsLoading(false);
            return;
        }
        const member = toCamelCase<HouseholdMember>(memberRow);
        const { data: hhRow, error: hhErr } = await supabase.from('households').select('*').eq('id', (memberRow as any).household_id).single();
        if (hhErr || !hhRow) {
            setHousehold(null);
            setIsLoading(false);
            return;
        }
        const hh = toCamelCase<Household>(hhRow);
        try {
            await loadEverything(hh, member.id, member.permission);
        } catch (e: any) {
            console.warn('loadEverything failed during bootstrap', e?.message);
        }
        setIsLoading(false);
    }, [user, loadEverything]);

    useEffect(() => { bootstrap(); }, [bootstrap]);

    // ─── Household lifecycle ────────────────────────────────────────────────
    const createHousehold = useCallback(async (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not signed in.' };
        try {
            const { data, error } = await supabase.rpc('create_household', {
                household_name: householdName, currency_code: currencyCode, currency_symbol: currencySymbol, owner_name: ownerName,
            });
            if (error) throw error;
            const memberRow = toCamelCase<HouseholdMember>(data);
            const { data: hhRow, error: hhErr } = await supabase.from('households').select('*').eq('id', (data as any).household_id).single();
            if (hhErr || !hhRow) throw hhErr || new Error('Household created but could not be loaded.');
            const hh = toCamelCase<Household>(hhRow);
            const cats = defaultCategories();
            const { error: catErr } = await supabase.from('categories').insert(cats.map((c) => toSnakeCase({ ...c, householdId: hh.id })));
            if (catErr) throw catErr;
            await loadEverything(hh, memberRow.id, 'full');
            return { error: null };
        } catch (e: any) {
            return { error: e?.message || 'Could not create household.' };
        }
    }, [user, loadEverything]);

    // "Try a sample family" -- seeds a brand-new household with 6 months of
    // realistic data (income, spending, a debt, a behind-pace goal, an
    // already-hit goal, net worth crossing positive) so every intelligence
    // screen has something real to show in the first minute, no manual data
    // entry required. Self-contained: builds its own category id lookup
    // instead of reading component state, since state set by an in-flight
    // insert isn't visible to this closure until after a re-render.
    const createSampleHousehold = useCallback(async (): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not signed in.' };
        try {
            const { data, error } = await supabase.rpc('create_household', {
                household_name: 'The Adeyemi Family', currency_code: 'NGN', currency_symbol: '₦', owner_name: 'You',
            });
            if (error) throw error;
            const memberRow = toCamelCase<HouseholdMember>(data);
            const { data: hhRow, error: hhErr } = await supabase.from('households').select('*').eq('id', (data as any).household_id).single();
            if (hhErr || !hhRow) throw hhErr || new Error('Household created but could not be loaded.');
            const hh = toCamelCase<Household>(hhRow);
            const householdId = hh.id;

            const { data: catRows, error: catErr } = await supabase.from('categories')
                .insert(defaultCategories().map((c) => toSnakeCase({ ...c, householdId })))
                .select();
            if (catErr) throw catErr;
            const cat = (name: string): string => {
                const id = (catRows ?? []).find((r: any) => r.name === name)?.id;
                if (!id) throw new Error(`Missing default category: ${name}`);
                return id;
            };

            const today = new Date();
            const dateFor = (monthsAgo: number, day: number) => {
                const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
                return d.toISOString().slice(0, 10);
            };
            const firstOfMonth = (monthsAgo: number) => {
                const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
                return d.toISOString().slice(0, 10);
            };

            await supabase.from('accounts').insert([
                toSnakeCase({ householdId, name: 'Joint Checking', type: 'bank', balance: 9200 }),
                toSnakeCase({ householdId, name: 'Emergency Savings', type: 'bank', balance: 3000 }),
            ]);

            const { data: incomeSourceRow, error: incErr } = await supabase.from('income_sources')
                .insert(toSnakeCase({ householdId, name: 'Salary', isPrimary: true, isRecurring: true, expectedMonthlyAmount: 6200 }))
                .select().single();
            if (incErr) throw incErr;

            await supabase.from('recurring_bills').insert([
                toSnakeCase({ householdId, name: 'Rent', amount: 1800, dueDay: 1, categoryId: cat('Housing'), active: true }),
                toSnakeCase({ householdId, name: 'Auto Loan Payment', amount: 450, dueDay: 5, categoryId: cat('Debt Payments'), active: true }),
                toSnakeCase({ householdId, name: 'Credit Card Payment', amount: 400, dueDay: 20, categoryId: cat('Debt Payments'), active: true }),
                toSnakeCase({ householdId, name: 'Streaming bundle', amount: 25, dueDay: 15, categoryId: cat('Subscriptions'), active: true }),
            ]);

            await supabase.from('debts').insert([
                toSnakeCase({ householdId, name: 'Auto Loan', type: 'auto', balance: 12000, originalPrincipal: 18000, aprPct: 7.5, minPayment: 450 }),
                toSnakeCase({ householdId, name: 'Visa Credit Card', type: 'credit_card', balance: 3200, aprPct: 24.99, minPayment: 400 }),
            ]);

            // Home Deposit: behind pace, so the goal-gap and "biggest
            // opportunity" features have something real to react to.
            const deadlineYear = today.getFullYear() + (today.getMonth() >= 5 ? 1 : 0);
            const { data: goal1, error: g1Err } = await supabase.from('goals')
                .insert(toSnakeCase({ householdId, type: 'savings', icon: 'home', title: 'Home Deposit', targetValue: 20000, currentValue: 8500, deadline: `${deadlineYear}-06-30` }))
                .select().single();
            if (g1Err) throw g1Err;
            // Family Vacation: already complete, so the milestone celebration
            // has something to fire on first load.
            const { data: goal2, error: g2Err } = await supabase.from('goals')
                .insert(toSnakeCase({ householdId, type: 'savings', icon: 'airplane', title: 'Family Vacation', targetValue: 2000, currentValue: 2000 }))
                .select().single();
            if (g2Err) throw g2Err;

            const contributions: Record<string, unknown>[] = [];
            for (let m = 5; m >= 0; m--) contributions.push(toSnakeCase({ goalId: goal1.id, date: dateFor(m, 25), amount: 700 }));
            contributions.push(toSnakeCase({ goalId: goal2.id, date: dateFor(5, 20), amount: 2000 }));
            await supabase.from('goal_contributions').insert(contributions);

            // Six months of transactions: months 3-5 are the "before" window,
            // months 0-2 the "after" -- discretionary spending grows much
            // faster than income between them, which is what the
            // lifestyle-creep detector is built to catch.
            const transactions: Record<string, unknown>[] = [];
            const pushTx = (monthsAgo: number, day: number, type: 'income' | 'expense', amount: number, categoryName: string, description: string, extra: Record<string, unknown> = {}) => {
                transactions.push(toSnakeCase({
                    householdId, date: dateFor(monthsAgo, day), type, amount, categoryId: cat(categoryName),
                    ownership: 'shared', description, isRecurring: false, ...extra,
                }));
            };
            for (let m = 5; m >= 0; m--) {
                const recent = m <= 2;
                pushTx(m, 5, 'income', recent ? 6200 : 5750, 'Salary', 'Salary', { incomeSourceId: incomeSourceRow.id });
                pushTx(m, 1, 'expense', 1800, 'Housing', 'Rent');
                pushTx(m, 8, 'expense', recent ? 700 : 650, 'Groceries', 'Groceries');
                pushTx(m, 10, 'expense', recent ? 300 : 280, 'Utilities', 'Utilities');
                pushTx(m, 12, 'expense', recent ? 300 : 270, 'Transport', 'Fuel & transport');
                pushTx(m, 15, 'expense', recent ? 500 : 250, 'Dining Out', 'Dining out');
                pushTx(m, 18, 'expense', recent ? 400 : 150, 'Entertainment', 'Entertainment');
                pushTx(m, 20, 'expense', recent ? 300 : 100, 'Subscriptions', 'Subscriptions');
                pushTx(m, 22, 'expense', recent ? 850 : 800, 'Debt Payments', 'Loan & card payments');
                pushTx(m, 25, 'expense', 700, 'Savings Transfer', 'Transfer to savings');
            }
            const { error: txErr } = await supabase.from('transactions').insert(transactions);
            if (txErr) throw txErr;

            // One budget, set to genuinely run over (planned 400 < actual
            // 500), so the daily insight has something concrete to lead
            // with. Deliberately not budgeting Groceries too: with a whole
            // month's spend logged as a single lump transaction, the pacing
            // projection reads spend that's actually under budget as "on
            // pace to exceed" -- a demo-data artifact, not a real signal.
            await supabase.from('budgets').insert(
                toSnakeCase({ householdId, categoryId: cat('Dining Out'), period: currentPeriod(), planned: 400 }),
            );

            // Net worth: negative five months ago, positive today -- fires
            // the "net worth turned positive" milestone on first load.
            await supabase.from('net_worth_snapshots').insert([
                toSnakeCase({ householdId, date: firstOfMonth(5), totalAssets: 8000, totalLiabilities: 16000, netWorth: -8000 }),
                toSnakeCase({ householdId, date: firstOfMonth(0), totalAssets: 22700, totalLiabilities: 15200, netWorth: 7500 }),
            ]);

            await loadEverything(hh, memberRow.id, 'full');
            return { error: null };
        } catch (e: any) {
            return { error: e?.message || 'Could not set up the sample family.' };
        }
    }, [user, loadEverything]);

    const joinHousehold = useCallback(async (inviteCode: string, memberName: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not signed in.' };
        try {
            const { data, error } = await supabase.rpc('join_household', { p_invite_code: inviteCode.trim(), member_name: memberName });
            if (error) throw error;
            const memberRow = toCamelCase<HouseholdMember>(data);
            const { data: hhRow, error: hhErr } = await supabase.from('households').select('*').eq('id', (data as any).household_id).single();
            if (hhErr || !hhRow) return { error: 'Joined, but could not load the household. Try restarting the app.' };
            await loadEverything(toCamelCase<Household>(hhRow), memberRow.id, memberRow.permission);
            return { error: null };
        } catch (e: any) {
            return { error: e.message || 'Could not join that household.' };
        }
    }, [user, loadEverything]);

    const inviteMember = useCallback(async (email: string, role: MemberRole, permission: MemberPermission): Promise<{ code: string | null; error: string | null }> => {
        if (!household || !user) return { code: null, error: 'No household yet.' };
        const code = generateInviteCode();
        try {
            const invite = await insertRow<HouseholdInvite>('household_invites', {
                householdId: household.id, email: email.trim().toLowerCase(), role, permission, inviteCode: code, invitedBy: user.id,
            });
            setPendingInvites((prev) => [...prev, invite]);
            return { code, error: null };
        } catch (e: any) {
            return { code: null, error: e.message || 'Could not create invite.' };
        }
    }, [household, user]);

    const removeMember = useCallback((id: string) => {
        deleteRow('household_members', id).then(() => {
            setMembers((prev) => prev.filter((m) => m.id !== id));
        }).catch((e) => console.warn('remove member failed', e.message));
    }, []);

    // ─── Generic collections ────────────────────────────────────────────────
    const categoryCrud = useMemo(() => makeCrud<Category>('categories', household?.id, setCategories), [household?.id]);
    const accountCrud = useMemo(() => makeCrud<Account>('accounts', household?.id, setAccounts), [household?.id]);
    const incomeSourceCrud = useMemo(() => makeCrud<IncomeSource>('income_sources', household?.id, setIncomeSources), [household?.id]);
    const transactionCrud = useMemo(() => makeCrud<Transaction>('transactions', household?.id, setTransactions), [household?.id]);
    const recurringBillCrud = useMemo(() => makeCrud<RecurringBill>('recurring_bills', household?.id, setRecurringBills), [household?.id]);
    const investmentCrud = useMemo(() => makeCrud<Investment>('investments', household?.id, setInvestments), [household?.id]);
    const debtCrud = useMemo(() => makeCrud<Debt>('debts', household?.id, setDebts), [household?.id]);
    const otherAssetCrud = useMemo(() => makeCrud<OtherAsset>('other_assets', household?.id, setOtherAssets), [household?.id]);

    const bulkAddTransactions = useCallback(async (rows: Array<Omit<Transaction, 'id' | 'createdAt'>>): Promise<{ error: string | null; count: number }> => {
        if (!household) return { error: 'No household yet.', count: 0 };
        if (rows.length === 0) return { error: null, count: 0 };
        try {
            const { data, error } = await supabase.from('transactions')
                .insert(rows.map((r) => toSnakeCase({ ...r, householdId: household.id })))
                .select();
            if (error) throw error;
            const created = (data ?? []).map((row) => toCamelCase<Transaction>(row));
            setTransactions((prev) => [...created, ...prev]);
            return { error: null, count: created.length };
        } catch (e: any) {
            return { error: e?.message || 'Import failed.', count: 0 };
        }
    }, [household]);

    const uploadReceiptForTransaction = useCallback(async (transactionId: string, localUri: string): Promise<{ error: string | null }> => {
        if (!household) return { error: 'No household yet.' };
        try {
            const path = await uploadReceiptImage(household.id, localUri);
            await updateRow('transactions', transactionId, { receiptUrl: path });
            setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, receiptUrl: path } : t)));
            return { error: null };
        } catch (e: any) {
            return { error: e?.message || 'Could not upload receipt.' };
        }
    }, [household]);

    // ─── Budgets (upsert by category+period) ───────────────────────────────
    const setBudget = useCallback((categoryId: string, period: string, planned: number) => {
        if (!household) return;
        supabase.from('budgets')
            .upsert(toSnakeCase({ householdId: household.id, categoryId, period, planned }), { onConflict: 'household_id,category_id,period' })
            .select().single()
            .then(({ data, error }) => {
                if (error || !data) { console.warn('budget upsert failed', error?.message); return; }
                const row = toCamelCase<Budget>(data);
                setBudgets((prev) => (prev.some((b) => b.id === row.id) ? prev.map((b) => (b.id === row.id ? row : b)) : [...prev, row]));
            });
    }, [household]);

    // ─── Goals (nested contributions) ──────────────────────────────────────
    const addGoal = useCallback((g: Omit<FinancialGoal, 'id' | 'createdAt' | 'contributions'>) => {
        if (!household) return;
        insertRow<FinancialGoal>('goals', { ...g, householdId: household.id }).then((created) => {
            setGoals((prev) => [...prev, { ...created, contributions: [] }]);
        }).catch((e) => console.warn('goal insert failed', e.message));
    }, [household]);

    const updateGoal = useCallback((id: string, patch: Partial<FinancialGoal>) => {
        updateRow('goals', id, patch).then(() => {
            setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
        }).catch((e) => console.warn('goal update failed', e.message));
    }, []);

    const removeGoal = useCallback((id: string) => {
        deleteRow('goals', id).then(() => {
            setGoals((prev) => prev.filter((g) => g.id !== id));
        }).catch((e) => console.warn('goal delete failed', e.message));
    }, []);

    const contributeToGoal = useCallback((id: string, amount: number, note?: string) => {
        const goal = goals.find((g) => g.id === id);
        if (!goal) return;
        insertRow<GoalContribution>('goal_contributions', { goalId: id, date: todayISO(), amount, note }).then(async (contribution) => {
            const newValue = goal.currentValue + amount;
            await updateRow('goals', id, { currentValue: newValue });
            setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, currentValue: newValue, contributions: [contribution, ...g.contributions] } : g)));
        }).catch((e) => console.warn('contribution failed', e.message));
    }, [goals]);

    // ─── Milestone celebrations (recorded once so they never re-fire) ──────
    const recordMilestones = useCallback(async (keys: string[]): Promise<void> => {
        if (!household || keys.length === 0) return;
        try {
            const { error } = await supabase.from('milestones_seen')
                .upsert(keys.map((key) => toSnakeCase({ householdId: household.id, key })), { onConflict: 'household_id,key', ignoreDuplicates: true });
            if (error) throw error;
            setSeenMilestoneKeys((prev) => Array.from(new Set([...prev, ...keys])));
        } catch (e: any) {
            console.warn('recordMilestones failed', e.message);
        }
    }, [household]);

    // ─── Net worth snapshots (one row per calendar month) ──────────────────
    const recordNetWorthSnapshot = useCallback((totalAssets: number, totalLiabilities: number) => {
        if (!household) return;
        const monthDate = `${currentPeriod()}-01`;
        supabase.from('net_worth_snapshots')
            .upsert(toSnakeCase({
                householdId: household.id, date: monthDate, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities,
            }), { onConflict: 'household_id,date' })
            .select().single()
            .then(({ data, error }) => {
                if (error || !data) return;
                const row = toCamelCase<NetWorthSnapshot>(data);
                setNetWorthHistory((prev) => {
                    const rest = prev.filter((s) => s.date !== row.date);
                    return [...rest, row].sort((a, b) => a.date.localeCompare(b.date));
                });
            });
    }, [household]);

    const value = useMemo<FinanceContextValue>(() => ({
        isLoading, isOnboarded: !!household, household, members, myMemberId, myPermission, pendingInvites,
        categories, accounts, incomeSources, transactions, recurringBills, budgets, goals,
        investments, debts, otherAssets, netWorthHistory, seenMilestoneKeys, recordMilestones,
        createHousehold, createSampleHousehold, joinHousehold, inviteMember, removeMember,
        addCategory: categoryCrud.add, updateCategory: categoryCrud.update, removeCategory: categoryCrud.remove,
        addAccount: accountCrud.add, updateAccount: accountCrud.update, removeAccount: accountCrud.remove,
        addIncomeSource: incomeSourceCrud.add, removeIncomeSource: incomeSourceCrud.remove,
        addTransaction: transactionCrud.add, updateTransaction: transactionCrud.update, removeTransaction: transactionCrud.remove,
        bulkAddTransactions, uploadReceiptForTransaction,
        addRecurringBill: recurringBillCrud.add, removeRecurringBill: recurringBillCrud.remove,
        setBudget,
        addGoal, updateGoal, removeGoal, contributeToGoal,
        addInvestment: investmentCrud.add, updateInvestment: investmentCrud.update, removeInvestment: investmentCrud.remove,
        addDebt: debtCrud.add, updateDebt: debtCrud.update, removeDebt: debtCrud.remove,
        addOtherAsset: otherAssetCrud.add, removeOtherAsset: otherAssetCrud.remove,
        recordNetWorthSnapshot,
    }), [
        isLoading, household, members, myMemberId, myPermission, pendingInvites,
        categories, accounts, incomeSources, transactions, recurringBills, budgets, goals,
        investments, debts, otherAssets, netWorthHistory, seenMilestoneKeys, recordMilestones,
        createHousehold, createSampleHousehold, joinHousehold, inviteMember, removeMember,
        categoryCrud, accountCrud, incomeSourceCrud, transactionCrud, recurringBillCrud,
        bulkAddTransactions, uploadReceiptForTransaction,
        setBudget, addGoal, updateGoal, removeGoal, contributeToGoal,
        investmentCrud, debtCrud, otherAssetCrud, recordNetWorthSnapshot,
    ]);

    return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
    const ctx = useContext(FinanceContext);
    if (!ctx) throw new Error('useFinance must be used within a FinanceProvider');
    return ctx;
}
