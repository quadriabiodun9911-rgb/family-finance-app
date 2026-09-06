// ─── Household ──────────────────────────────────────────────────────────────
export type MemberRole = 'owner' | 'partner' | 'teen' | 'child';
// Drives what a member can see: 'full' sees every household number, 'shared'
// sees shared accounts/goals plus their own, 'own' sees only their own
// transactions and personal goals (e.g. a teen's allowance).
export type MemberPermission = 'full' | 'shared' | 'own';

export interface HouseholdMember {
    id: string;
    userId?: string; // the Supabase auth user this member row belongs to; unset only in legacy local-only data
    name: string;
    role: MemberRole;
    permission: MemberPermission;
    color: string;
    createdAt: string;
}

export interface Household {
    id: string;
    ownerId?: string;
    name: string;
    currencyCode: string; // ISO code, e.g. 'NGN', 'USD'
    currencySymbol: string;
    createdAt: string;
}

export type InviteStatus = 'pending' | 'accepted';

// A household owner's standing offer for someone to join by entering
// `inviteCode` on the Join Household screen — see HouseholdContext.joinHousehold.
export interface HouseholdInvite {
    id: string;
    householdId: string;
    email: string;
    role: MemberRole;
    permission: MemberPermission;
    inviteCode: string;
    invitedBy: string;
    status: InviteStatus;
    createdAt: string;
}

// ─── Categories & Accounts ──────────────────────────────────────────────────
export type CategoryType = 'income' | 'expense';

export interface Category {
    id: string;
    name: string;
    type: CategoryType;
    icon: string; // @expo/vector-icons Ionicons name
    color: string;
    // The household's own target for this category, e.g. "Groceries should
    // be ~$700/month" — separate from a period Budget, which is the actual
    // planned amount for one specific month. This is the longer-running
    // expectation spending-trend narratives compare against.
    monthlyTarget?: number;
    isDefault?: boolean;
}

export type AccountType = 'cash' | 'bank' | 'card' | 'other';

export interface Account {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
    createdAt: string;
}

// ─── Income sources ─────────────────────────────────────────────────────────
// Lets Income Intelligence tell "one household breadwinner" apart from a
// diversified income base, and recognize the same irregular payer showing up
// repeatedly (freelance/gig income) as a candidate to treat as recurring.
export interface IncomeSource {
    id: string;
    name: string;
    memberId?: string;
    isPrimary: boolean;
    isRecurring: boolean;
    expectedMonthlyAmount?: number;
    createdAt: string;
}

// ─── Transactions ───────────────────────────────────────────────────────────
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
// 'my' / 'partner' ties a transaction to one member's own money; 'shared' is
// household money — the distinction the product needs to separate "my
// money → your money → our money".
export type Ownership = 'shared' | 'individual';

export interface Transaction {
    id: string;
    date: string; // ISO date YYYY-MM-DD
    type: CategoryType;
    amount: number;
    categoryId: string;
    memberId?: string;
    incomeSourceId?: string; // only set for type 'income'
    accountId?: string;
    ownership: Ownership;
    description: string;
    isRecurring: boolean;
    recurringFrequency?: RecurringFrequency;
    createdAt: string;
}

// ─── Recurring bills (known, expected outflows) ────────────────────────────
export interface RecurringBill {
    id: string;
    name: string;
    amount: number;
    dueDay: number; // 1-31, day of month
    categoryId: string;
    active: boolean;
    createdAt: string;
}

// ─── Budgets (Planned → Actual → Forecast) ─────────────────────────────────
export interface Budget {
    id: string;
    categoryId: string;
    period: string; // YYYY-MM
    planned: number;
}

// ─── Goals ──────────────────────────────────────────────────────────────────
export type GoalType = 'savings' | 'debt' | 'investment' | 'custom';
export type GoalIcon = 'home' | 'shield' | 'school' | 'card' | 'trending-up' | 'flag' | 'airplane' | 'car';

export interface GoalContribution {
    id: string;
    date: string;
    amount: number; // negative for a debt-payoff goal's paydown, positive otherwise
    note?: string;
}

export interface FinancialGoal {
    id: string;
    type: GoalType;
    icon: GoalIcon;
    title: string;
    // For a debt-payoff goal, target is 0 and current starts at the debt
    // balance and counts down — every other goal type counts up toward target.
    targetValue: number;
    currentValue: number;
    deadline?: string; // ISO date
    memberId?: string; // undefined = shared household goal
    contributions: GoalContribution[];
    createdAt: string;
}

// ─── Savings & Investments ──────────────────────────────────────────────────
export type InvestmentType = 'stocks' | 'etf' | 'bonds' | 'mutual_fund' | 'retirement' | 'property' | 'other';

export interface Investment {
    id: string;
    name: string;
    type: InvestmentType;
    costBasis: number;
    currentValue: number;
    memberId?: string;
    purchaseDate: string;
    updatedAt: string;
    createdAt: string;
}

// ─── Debts & other assets (net worth inputs beyond accounts/investments) ───
export interface Debt {
    id: string;
    name: string;
    balance: number;
    aprPct?: number;
    minPayment?: number;
    linkedGoalId?: string; // a debt can also be tracked as a payoff FinancialGoal
    createdAt: string;
}

export type OtherAssetType = 'property' | 'vehicle' | 'other';

export interface OtherAsset {
    id: string;
    name: string;
    type: OtherAssetType;
    value: number;
    createdAt: string;
}

// ─── Net worth history ──────────────────────────────────────────────────────
export interface NetWorthSnapshot {
    id: string;
    date: string; // ISO date YYYY-MM-DD, first-of-month snapshot
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
}

// ─── Intelligence output types ──────────────────────────────────────────────
export type InsightSeverity = 'good' | 'watch' | 'warning';
export type InsightArea = 'cashflow' | 'spending' | 'budget' | 'goals' | 'networth' | 'income';

export interface Insight {
    id: string;
    area: InsightArea;
    severity: InsightSeverity;
    title: string;
    message: string;
}

export type HealthAreaStatus = 'strong' | 'on-track' | 'watch' | 'off-track';

export interface HealthAreaScore {
    area: InsightArea;
    label: string;
    status: HealthAreaStatus;
}

export interface FinancialHealthReport {
    score: number; // 0-100
    scoreDeltaFromLastMonth?: number;
    areas: HealthAreaScore[];
}
