import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, StatCard, Button } from '../components/ui';
import QuickAddTextBar from '../components/QuickAddTextBar';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeCashFlowSummary } from '../intelligence/cashFlow';
import { computeBudgetLines } from '../intelligence/budgetPlan';
import { computeAllGoalPaces } from '../intelligence/goalPace';
import { computeFinancialHealthReport, healthStatusLabel } from '../intelligence/health';
import { generateIncomeInsights } from '../intelligence/income';
import { formatMoney } from '../utils/currency';
import { currentPeriod, periodLabel } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const QUICK_LINKS: { key: keyof RootStackParamList; label: string; icon: any; desc: string }[] = [
    { key: 'Reports', label: 'Daily · Weekly · Monthly', icon: 'newspaper', desc: 'Your financial pulse & reviews' },
    { key: 'Analysis', label: 'Spending Analysis', icon: 'analytics', desc: 'Why your spending is changing' },
    { key: 'IncomeInsights', label: 'Income Intelligence', icon: 'rocket', desc: 'Ways to grow household income' },
    { key: 'SavingsInvestments', label: 'Net Worth', icon: 'diamond', desc: 'Savings, investments & net worth' },
    { key: 'Coach', label: 'Ask the Coach', icon: 'chatbubble-ellipses', desc: 'Financial health & affordability' },
    { key: 'RiskDecision', label: 'Risk & Decisions', icon: 'shield-half', desc: 'What could go wrong, and what to do' },
];

export default function DashboardScreen() {
    const navigation = useNavigation<Nav>();
    const { household, transactions, accounts, recurringBills, budgets, categories, goals, incomeSources, debts } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const period = currentPeriod();

    const cashFlow = useMemo(() => computeCashFlowSummary(transactions, accounts, recurringBills, period), [transactions, accounts, recurringBills, period]);
    const budgetLines = useMemo(() => computeBudgetLines(budgets, categories, transactions, period), [budgets, categories, transactions, period]);
    const goalPaces = useMemo(() => computeAllGoalPaces(goals, symbol), [goals, symbol]);
    const incomeInsights = useMemo(() => generateIncomeInsights(transactions, incomeSources, symbol), [transactions, incomeSources, symbol]);
    const health = useMemo(() => computeFinancialHealthReport(cashFlow, budgetLines, goalPaces, debts, incomeInsights), [cashFlow, budgetLines, goalPaces, debts, incomeInsights]);

    const atRiskGoals = goalPaces.filter((g) => g.onTrack === false).length;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.container}>
                <QuickAddTextBar />
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>{household?.name || 'Your household'}</Text>
                        <Text style={styles.periodLabel}>{periodLabel(period)}</Text>
                    </View>
                    <Pressable style={styles.healthPill} onPress={() => navigation.navigate('Coach')}>
                        <Text style={styles.healthScore}>{health.score}</Text>
                        <Text style={styles.healthLabel}>Health</Text>
                    </Pressable>
                </View>

                <Card style={styles.cashFlowCard}>
                    <Text style={styles.cardEyebrow}>Cash Flow Intelligence</Text>
                    <Text style={styles.surplusValue}>
                        {cashFlow.surplus >= 0 ? '+' : ''}{formatMoney(cashFlow.surplus, symbol)}
                    </Text>
                    <Text style={styles.surplusCaption}>
                        {`Your household generated ${formatMoney(cashFlow.income, symbol)} this month and spent ${formatMoney(cashFlow.expense, symbol)}${cashFlow.surplus >= 0 ? `, leaving a ${formatMoney(cashFlow.surplus, symbol)} surplus.` : '.'}`}
                        {cashFlow.committedNextMonth > 0 ? ` ${formatMoney(cashFlow.committedNextMonth, symbol)} of upcoming bills are already committed.` : ''}
                    </Text>
                    <View style={styles.statRow}>
                        <StatCard label="Income" value={formatMoney(cashFlow.income, symbol)} valueColor={Colors.income} flex={1} />
                        <StatCard label="Expenses" value={formatMoney(cashFlow.expense, symbol)} valueColor={Colors.expense} flex={1} />
                        <StatCard label="Cash on hand" value={formatMoney(cashFlow.accountsBalance, symbol)} flex={1} />
                    </View>
                </Card>

                {cashFlow.upcomingBills.length > 0 && (
                    <Card style={styles.billsCard}>
                        <Text style={styles.sectionTitle}>Upcoming bills</Text>
                        {cashFlow.upcomingBills.slice(0, 3).map((u) => (
                            <View key={u.bill.id} style={styles.billRow}>
                                <Ionicons name="calendar" size={16} color={Colors.textMuted} />
                                <Text style={styles.billName}>{u.bill.name}</Text>
                                <Text style={styles.billMeta}>{formatMoney(u.bill.amount, symbol)} · {u.daysAway === 0 ? 'today' : `in ${u.daysAway}d`}</Text>
                            </View>
                        ))}
                    </Card>
                )}

                <View style={styles.linksGrid}>
                    {QUICK_LINKS.map((link) => (
                        <Pressable key={link.key} style={styles.linkCard} onPress={() => navigation.navigate(link.key as any)}>
                            <View style={styles.linkIconWrap}>
                                <Ionicons name={link.icon} size={18} color={Colors.primary} />
                            </View>
                            <Text style={styles.linkLabel}>{link.label}</Text>
                            <Text style={styles.linkDesc}>{link.desc}</Text>
                        </Pressable>
                    ))}
                </View>

                {atRiskGoals > 0 && (
                    <Card style={styles.warnCard}>
                        <Ionicons name="alert-circle" size={18} color={Colors.watch} />
                        <Text style={styles.warnText}>{atRiskGoals} goal{atRiskGoals > 1 ? 's are' : ' is'} behind pace. Open Goals to see what it takes to catch up.</Text>
                    </Card>
                )}

                <View style={styles.addRow}>
                    <Button label="Add expense" variant="secondary" onPress={() => navigation.navigate('AddTransaction', { type: 'expense' })} style={{ flex: 1 }} />
                    <Button label="Add income" onPress={() => navigation.navigate('AddTransaction', { type: 'income' })} style={{ flex: 1 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greeting: { color: Colors.text, fontSize: 20, fontWeight: '800' },
    periodLabel: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
    healthPill: { alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    healthScore: { color: Colors.primary, fontSize: 18, fontWeight: '800' },
    healthLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
    cashFlowCard: { gap: Spacing.sm },
    cardEyebrow: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    surplusValue: { color: Colors.text, fontSize: 30, fontWeight: '800' },
    surplusCaption: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
    statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    billsCard: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    billRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    billName: { color: Colors.text, fontSize: 13, flex: 1 },
    billMeta: { color: Colors.textMuted, fontSize: 12 },
    linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    linkCard: { width: '48%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
    linkIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    linkLabel: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    linkDesc: { color: Colors.textFaint, fontSize: 11, lineHeight: 15 },
    warnCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.watchMuted, borderColor: Colors.watch },
    warnText: { color: Colors.text, fontSize: 13, flex: 1 },
    addRow: { flexDirection: 'row', gap: Spacing.sm },
});
