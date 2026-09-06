import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { Card } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeBudgetLines } from '../intelligence/budgetPlan';
import { buildDailyPulse, buildWeeklyReview, buildMonthlyReport } from '../intelligence/reports';
import { computeFinancialHealthReport, healthStatusLabel } from '../intelligence/health';
import { computeCashFlowSummary } from '../intelligence/cashFlow';
import { computeAllGoalPaces } from '../intelligence/goalPace';
import { generateIncomeInsights } from '../intelligence/income';
import { formatMoney } from '../utils/currency';
import { currentPeriod } from '../utils/date';

type Tab = 'daily' | 'weekly' | 'monthly';
const STATUS_DOT: Record<'good' | 'watch' | 'warning', string> = { good: '🟢', watch: '🟡', warning: '🔴' };

export default function ReportsScreen() {
    const { household, transactions, categories, budgets, recurringBills, goals, incomeSources, accounts, debts } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [tab, setTab] = useState<Tab>('daily');
    const period = currentPeriod();

    const budgetLines = useMemo(() => computeBudgetLines(budgets, categories, transactions, period), [budgets, categories, transactions, period]);
    const daily = useMemo(() => buildDailyPulse(transactions, budgetLines, recurringBills, symbol), [transactions, budgetLines, recurringBills, symbol]);
    const weekly = useMemo(() => buildWeeklyReview(transactions, categories, goals, symbol), [transactions, categories, goals, symbol]);
    const monthly = useMemo(() => buildMonthlyReport(transactions, categories, incomeSources, budgetLines, symbol, period), [transactions, categories, incomeSources, budgetLines, symbol, period]);

    const cashFlow = useMemo(() => computeCashFlowSummary(transactions, accounts, recurringBills, period), [transactions, accounts, recurringBills, period]);
    const goalPaces = useMemo(() => computeAllGoalPaces(goals, symbol), [goals, symbol]);
    const incomeInsights = useMemo(() => generateIncomeInsights(transactions, incomeSources, symbol), [transactions, incomeSources, symbol]);
    const health = useMemo(() => computeFinancialHealthReport(cashFlow, budgetLines, goalPaces, debts, incomeInsights), [cashFlow, budgetLines, goalPaces, debts, incomeInsights]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Financial Reports" />
            <View style={styles.tabRow}>
                {(['daily', 'weekly', 'monthly'] as Tab[]).map((t) => (
                    <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabChip, tab === t && styles.tabChipActive]}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Text>
                    </Pressable>
                ))}
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                {tab === 'daily' && (
                    <>
                        <Card style={styles.headerCard}>
                            <Text style={styles.greeting}>Good morning 👋</Text>
                            <Text style={styles.dateLabel}>{daily.dateLabel}</Text>
                        </Card>
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>Yesterday</Text>
                            <Text style={styles.line}>💰 Income: {formatMoney(daily.yesterdayIncome, symbol)}</Text>
                            <Text style={styles.line}>💸 Expenses: {formatMoney(daily.yesterdayExpense, symbol)}</Text>
                            <Text style={[styles.line, { fontWeight: '800' }]}>📈 Net cash flow: {daily.yesterdayNet >= 0 ? '+' : ''}{formatMoney(daily.yesterdayNet, symbol)}</Text>
                        </Card>
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>This month</Text>
                            <Text style={styles.line}>Income: {formatMoney(daily.monthIncome, symbol)}</Text>
                            <Text style={styles.line}>Expenses: {formatMoney(daily.monthExpense, symbol)}</Text>
                            <Text style={styles.line}>Savings: {formatMoney(daily.monthSavings, symbol)}</Text>
                        </Card>
                        {daily.budgetStatuses.length > 0 && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>Budget status</Text>
                                {daily.budgetStatuses.map((b, i) => (
                                    <Text key={i} style={styles.line}>{STATUS_DOT[b.status]} {b.categoryName} — {b.status === 'good' ? 'On track' : b.status === 'watch' ? 'Running ahead of pace' : 'Above target'}</Text>
                                ))}
                            </Card>
                        )}
                        {daily.nextBill && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>Upcoming</Text>
                                <Text style={styles.line}>{daily.nextBill.name} — {formatMoney(daily.nextBill.amount, symbol)} in {daily.nextBill.daysAway} day{daily.nextBill.daysAway === 1 ? '' : 's'}</Text>
                            </Card>
                        )}
                        <Card style={[styles.card, styles.suggestionCard]}>
                            <Text style={styles.cardTitle}>Today's suggestion</Text>
                            <Text style={styles.suggestionText}>
                                Keep discretionary spending below {formatMoney(daily.suggestedDailySpendLimit, symbol)} today to stay on plan for the month.
                            </Text>
                        </Card>
                    </>
                )}

                {tab === 'weekly' && (
                    <>
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>This week</Text>
                            <Text style={styles.line}>Income: {formatMoney(weekly.weekIncome, symbol)}</Text>
                            <Text style={styles.line}>Expenses: {formatMoney(weekly.weekExpense, symbol)}</Text>
                            <Text style={[styles.line, { fontWeight: '800' }]}>Surplus: {weekly.weekSurplus >= 0 ? '+' : ''}{formatMoney(weekly.weekSurplus, symbol)}</Text>
                        </Card>
                        {weekly.movers.length > 0 && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>What happened?</Text>
                                {weekly.movers.map((m, i) => (
                                    <Text key={i} style={styles.line}>{m.direction === 'up' ? '📈' : '📉'} {m.categoryName} {m.direction === 'up' ? 'increased' : 'decreased'} {Math.abs(m.changePct).toFixed(0)}%.</Text>
                                ))}
                            </Card>
                        )}
                        {weekly.concerning && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>What's concerning?</Text>
                                <Text style={styles.line}>{weekly.concerning}</Text>
                            </Card>
                        )}
                        {weekly.goingWell && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>What's going well?</Text>
                                <Text style={styles.line}>{weekly.goingWell}</Text>
                            </Card>
                        )}
                        <Card style={[styles.card, styles.suggestionCard]}>
                            <Text style={styles.cardTitle}>Recommendation</Text>
                            <Text style={styles.suggestionText}>{weekly.recommendation}</Text>
                        </Card>
                    </>
                )}

                {tab === 'monthly' && (
                    <>
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>{monthly.periodLabel} — Financial Health Score</Text>
                            <Text style={styles.healthScore}>{health.score} / 100</Text>
                            {health.areas.map((a) => (
                                <View key={a.area} style={styles.areaRow}>
                                    <Text style={styles.areaLabel}>{a.label}</Text>
                                    <Text style={styles.areaStatus}>{healthStatusLabel(a.status)}</Text>
                                </View>
                            ))}
                        </Card>
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>This month</Text>
                            <Text style={styles.line}>Income: {formatMoney(monthly.income, symbol)}</Text>
                            <Text style={styles.line}>Expenses: {formatMoney(monthly.expense, symbol)}</Text>
                            <Text style={[styles.line, { fontWeight: '800' }]}>Net cash flow: {monthly.netCashFlow >= 0 ? '+' : ''}{formatMoney(monthly.netCashFlow, symbol)}</Text>
                        </Card>
                        {monthly.biggestImprovement && (
                            <Card style={styles.card}><Text style={styles.cardTitle}>Biggest improvement</Text><Text style={styles.line}>{monthly.biggestImprovement}</Text></Card>
                        )}
                        {monthly.biggestConcern && (
                            <Card style={styles.card}><Text style={styles.cardTitle}>Biggest concern</Text><Text style={styles.line}>{monthly.biggestConcern}</Text></Card>
                        )}
                        <Card style={styles.card}>
                            <Text style={styles.cardTitle}>Financial forecast</Text>
                            <Text style={styles.line}>At the current trajectory, projected annual savings are approximately {formatMoney(monthly.projectedAnnualSavings, symbol)}.</Text>
                        </Card>
                        {monthly.recommendedActions.length > 0 && (
                            <Card style={styles.card}>
                                <Text style={styles.cardTitle}>Recommended actions</Text>
                                {monthly.recommendedActions.map((a, i) => <Text key={i} style={styles.line}>• {a}</Text>)}
                            </Card>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    tabRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    tabChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    tabChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
    headerCard: { gap: 2 },
    greeting: { color: Colors.text, fontSize: 18, fontWeight: '800' },
    dateLabel: { color: Colors.textMuted, fontSize: 13 },
    card: { gap: 4 },
    cardTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
    line: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
    suggestionCard: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    suggestionText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
    healthScore: { color: Colors.primary, fontSize: 28, fontWeight: '800', marginBottom: 6 },
    areaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    areaLabel: { color: Colors.textMuted, fontSize: 13 },
    areaStatus: { color: Colors.text, fontSize: 13, fontWeight: '700' },
});
