import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { Card, Button } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeCashFlowSummary } from '../intelligence/cashFlow';
import { computeBudgetLines } from '../intelligence/budgetPlan';
import { computeAllGoalPaces } from '../intelligence/goalPace';
import { computeFinancialHealthReport, healthVerdict, healthVerdictLabel } from '../intelligence/health';
import { generateIncomeInsights } from '../intelligence/income';
import { generateSpendingInsights, computeAllCategoryTrends } from '../intelligence/spending';
import { generateBudgetInsights } from '../intelligence/budgetPlan';
import { generateCoachSummary, computeAffordability, computeBiggestOpportunity } from '../intelligence/coach';
import { detectLifestyleCreep } from '../intelligence/lifestyleCreep';
import { currentPeriod } from '../utils/date';
import { formatMoney } from '../utils/currency';

const VERDICT_META = {
    healthy: { color: Colors.good, bg: Colors.goodMuted, icon: '🟢' },
    attention: { color: Colors.watch, bg: Colors.watchMuted, icon: '🟠' },
    critical: { color: Colors.warning, bg: Colors.warningMuted, icon: '🔴' },
};

export default function CoachScreen() {
    const { household, transactions, accounts, recurringBills, budgets, categories, goals, incomeSources, debts } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const period = currentPeriod();
    const [scenarioAmount, setScenarioAmount] = useState('');

    const cashFlow = useMemo(() => computeCashFlowSummary(transactions, accounts, recurringBills, period), [transactions, accounts, recurringBills, period]);
    const budgetLines = useMemo(() => computeBudgetLines(budgets, categories, transactions, period), [budgets, categories, transactions, period]);
    const goalPaces = useMemo(() => computeAllGoalPaces(goals, symbol), [goals, symbol]);
    const incomeInsights = useMemo(() => generateIncomeInsights(transactions, incomeSources, symbol), [transactions, incomeSources, symbol]);
    const health = useMemo(() => computeFinancialHealthReport(cashFlow, budgetLines, goalPaces, debts, incomeInsights), [cashFlow, budgetLines, goalPaces, debts, incomeInsights]);

    const trends = useMemo(() => computeAllCategoryTrends(transactions, categories), [transactions, categories]);
    const lifestyleCreep = useMemo(() => detectLifestyleCreep(transactions, symbol), [transactions, symbol]);
    const allInsights = useMemo(() => [
        ...generateBudgetInsights(budgetLines, symbol),
        ...generateSpendingInsights(trends, symbol),
        ...incomeInsights,
        ...(lifestyleCreep ? [lifestyleCreep] : []),
    ], [budgetLines, trends, incomeInsights, lifestyleCreep, symbol]);

    const summary = useMemo(() => generateCoachSummary(health, allInsights, symbol), [health, allInsights, symbol]);
    const verdict = healthVerdict(health.score);
    const verdictMeta = VERDICT_META[verdict];
    const biggestOpportunity = useMemo(() => computeBiggestOpportunity(goalPaces, recurringBills, symbol), [goalPaces, recurringBills, symbol]);

    const scenarioValue = parseFloat(scenarioAmount);
    const affordability = !Number.isNaN(scenarioValue) && scenarioValue > 0 ? computeAffordability(scenarioValue, cashFlow, symbol) : null;

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Ask the Coach" subtitle="How are we doing? Can we afford this?" />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.summaryCard}>
                    <View style={[styles.verdictBadge, { backgroundColor: verdictMeta.bg, borderColor: verdictMeta.color }]}>
                        <Text style={styles.verdictBadgeIcon}>{verdictMeta.icon}</Text>
                        <Text style={[styles.verdictBadgeText, { color: verdictMeta.color }]}>{healthVerdictLabel(verdict)}</Text>
                    </View>
                    <Text style={styles.headline}>{summary.headline}</Text>
                    {summary.focusAreas.map((f, i) => <Text key={i} style={styles.focusLine}>{i + 1}. {f}</Text>)}
                    <Text style={styles.priority}>{summary.priority}</Text>
                    {biggestOpportunity && (
                        <View style={styles.opportunityBox}>
                            <Text style={styles.opportunityLabel}>Biggest opportunity</Text>
                            <Text style={styles.opportunityText}>{biggestOpportunity}</Text>
                        </View>
                    )}
                </Card>

                <Card style={styles.scenarioCard}>
                    <Text style={styles.sectionTitle}>Can we afford it?</Text>
                    <Text style={styles.scenarioHint}>Enter a new monthly payment (a car loan, rent increase, school fees) to see how it fits your cash flow.</Text>
                    <View style={styles.scenarioRow}>
                        <TextInput
                            style={styles.input}
                            placeholder={`New monthly cost (${symbol})`}
                            placeholderTextColor={Colors.textFaint}
                            keyboardType="decimal-pad"
                            value={scenarioAmount}
                            onChangeText={setScenarioAmount}
                        />
                    </View>
                    {affordability && (
                        <View style={[styles.verdictBox, {
                            backgroundColor: affordability.verdict === 'comfortable' ? Colors.goodMuted : affordability.verdict === 'tight' ? Colors.watchMuted : Colors.warningMuted,
                        }]}>
                            <Text style={[styles.verdictLabel, {
                                color: affordability.verdict === 'comfortable' ? Colors.good : affordability.verdict === 'tight' ? Colors.watch : Colors.warning,
                            }]}>
                                {affordability.verdict === 'comfortable' ? 'Comfortable' : affordability.verdict === 'tight' ? 'Tight but possible' : 'Not recommended'}
                            </Text>
                            <Text style={styles.verdictText}>{affordability.narrative}</Text>
                        </View>
                    )}
                </Card>

                <Card style={styles.footnoteCard}>
                    <Text style={styles.footnote}>
                        This coach reasons from the numbers you've entered — cash flow, budgets, and goals — using deterministic rules, not a live AI model. Its scope will grow as more history builds up.
                    </Text>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    summaryCard: { gap: Spacing.sm },
    verdictBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    verdictBadgeIcon: { fontSize: 12 },
    verdictBadgeText: { fontSize: 12, fontWeight: '800' },
    headline: { color: Colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
    focusLine: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
    priority: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginTop: 4 },
    opportunityBox: { marginTop: Spacing.xs, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
    opportunityLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    opportunityText: { color: Colors.text, fontSize: 13, lineHeight: 19 },
    scenarioCard: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    scenarioHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
    scenarioRow: { flexDirection: 'row', gap: Spacing.sm },
    input: { flex: 1, minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text },
    verdictBox: { borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
    verdictLabel: { fontSize: 13, fontWeight: '800' },
    verdictText: { color: Colors.text, fontSize: 13, lineHeight: 19 },
    footnoteCard: { backgroundColor: Colors.surfaceAlt },
    footnote: { color: Colors.textFaint, fontSize: 11, lineHeight: 16 },
});
