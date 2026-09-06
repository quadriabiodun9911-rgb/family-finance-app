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
import { todayISO, currentPeriod } from '../utils/date';
import { useAuth } from './AuthContext';
import { Colors } from '../theme/colors';

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

    createHousehold: (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string) => Promise<void>;
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

    const loadEverything = useCallback(async (hh: Household, memberId: string, permission: MemberPermission) => {
        const [
            membersRows, invitesRows, categoriesRows, accountsRows, incomeSourcesRows,
            transactionsRows, recurringBillsRows, budgetsRows, goalsRows, investmentsRows,
            debtsRows, otherAssetsRows, netWorthRows,
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

        setMembers(membersRows);
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
            setDebts([]); setOtherAssets([]); setNetWorthHistory([]);
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
        await loadEverything(hh, member.id, member.permission);
        setIsLoading(false);
    }, [user, loadEverything]);

    useEffect(() => { bootstrap(); }, [bootstrap]);

    // ─── Household lifecycle ────────────────────────────────────────────────
    const createHousehold = useCallback(async (householdName: string, ownerName: string, currencyCode: string, currencySymbol: string) => {
        if (!user) return;
        const hhRow = await insertRow<Household>('households', { name: householdName, currencyCode, currencySymbol, ownerId: user.id });
        const memberRow = await insertRow<HouseholdMember>('household_members', {
            householdId: hhRow.id, userId: user.id, name: ownerName, role: 'owner', permission: 'full', color: Colors.memberPalette[0],
        });
        const cats = defaultCategories();
        await supabase.from('categories').insert(cats.map((c) => toSnakeCase({ ...c, householdId: hhRow.id })));
        await loadEverything(hhRow, memberRow.id, 'full');
    }, [user, loadEverything]);

    const joinHousehold = useCallback(async (inviteCode: string, memberName: string): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not signed in.' };
        const code = inviteCode.trim().toUpperCase();
        const { data: inviteRow, error: findErr } = await supabase
            .from('household_invites').select('*').eq('invite_code', code).eq('status', 'pending').maybeSingle();
        if (findErr || !inviteRow) return { error: 'Invite code not found or already used.' };
        const invite = toCamelCase<HouseholdInvite>(inviteRow);
        const paletteIndex = (await supabase.from('household_members').select('id', { count: 'exact', head: true }).eq('household_id', invite.householdId)).count ?? 0;
        try {
            const memberRow = await insertRow<HouseholdMember>('household_members', {
                householdId: invite.householdId, userId: user.id, name: memberName,
                role: invite.role, permission: invite.permission, color: Colors.memberPalette[paletteIndex % Colors.memberPalette.length],
            });
            await updateRow('household_invites', invite.id, { status: 'accepted' });
            const { data: hhRow, error: hhErr } = await supabase.from('households').select('*').eq('id', invite.householdId).single();
            if (hhErr || !hhRow) return { error: 'Joined, but could not load the household. Try restarting the app.' };
            await loadEverything(toCamelCase<Household>(hhRow), memberRow.id, invite.permission);
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
        investments, debts, otherAssets, netWorthHistory,
        createHousehold, joinHousehold, inviteMember, removeMember,
        addCategory: categoryCrud.add, updateCategory: categoryCrud.update, removeCategory: categoryCrud.remove,
        addAccount: accountCrud.add, updateAccount: accountCrud.update, removeAccount: accountCrud.remove,
        addIncomeSource: incomeSourceCrud.add, removeIncomeSource: incomeSourceCrud.remove,
        addTransaction: transactionCrud.add, updateTransaction: transactionCrud.update, removeTransaction: transactionCrud.remove,
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
        investments, debts, otherAssets, netWorthHistory,
        createHousehold, joinHousehold, inviteMember, removeMember,
        categoryCrud, accountCrud, incomeSourceCrud, transactionCrud, recurringBillCrud,
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
