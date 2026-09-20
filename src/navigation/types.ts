export type RootStackParamList = {
    Auth: undefined;
    HouseholdSetup: undefined;
    Tabs: undefined;
    AddTransaction: { type?: 'income' | 'expense'; transactionId?: string } | undefined;
    AddGoal: undefined;
    GoalDetail: { goalId: string };
    SavingsInvestments: undefined;
    Analysis: undefined;
    Reports: undefined;
    IncomeInsights: undefined;
    Coach: undefined;
    Household: undefined;
    ImportStatement: undefined;
    RiskDecision: undefined;
    DebtIntelligence: undefined;
    Ledger: undefined;
    IncomeAllocation: undefined;
};

export type TabParamList = {
    Home: undefined;
    Transactions: undefined;
    Budget: undefined;
    Goals: undefined;
    More: undefined;
};
