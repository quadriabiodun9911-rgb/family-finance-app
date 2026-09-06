export type RootStackParamList = {
    Auth: undefined;
    HouseholdSetup: undefined;
    Tabs: undefined;
    AddTransaction: { type?: 'income' | 'expense' } | undefined;
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
};

export type TabParamList = {
    Home: undefined;
    Transactions: undefined;
    Budget: undefined;
    Goals: undefined;
    More: undefined;
};
