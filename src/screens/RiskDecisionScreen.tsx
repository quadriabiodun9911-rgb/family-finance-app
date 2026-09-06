import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { Card, Button, FormField, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeCashFlowSummary } from '../intelligence/cashFlow';
import { computeBudgetLines } from '../intelligence/budgetPlan';
import { computeAllGoalPaces } from '../intelligence/goalPace';
import { computeIncomeConcentration } from '../intelligence/income';
import { computeRiskReport, RiskFactor, RiskLevel, averageMonthlyExpense } from '../intelligence/risk';
import { simulateDecision, DecisionType, DecisionImpact } from '../intelligence/decisionSimulator';
import { formatMoney } from '../utils/currency';
import { currentPeriod } from '../utils/date';

type Tab = 'risk' | 'decisions';

const LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
    low: { label: 'Low overall risk', color: Colors.good, bg: Colors.goodMuted },
    medium: { label: 'Some risks to watch', color: Colors.watch, bg: Colors.watchMuted },
    high: { label: 'Meaningful risk right now', color: Colors.warning, bg: Colors.warningMuted },
};

const SEVERITY_META = {
    medium: { color: Colors.watch, bg: Colors.watchMuted, label: 'Watch' },
    high: { color: Colors.warning, bg: Colors.warningMuted, label: 'High' },
};

const DECISION_OPTIONS: { type: DecisionType; label: string; icon: any }[] = [
    { type: 'new_expense', label: 'New recurring cost', icon: 'repeat' },
    { type: 'new_debt', label: 'New loan / debt', icon: 'card' },
    { type: 'income_change', label: 'Income change', icon: 'trending-up' },
    { type: 'one_time_purchase', label: 'One-time purchase', icon: 'cart' },
];

const VERDICT_META = {
    safe: { color: Colors.good, bg: Colors.goodMuted, label: 'Looks safe' },
    caution: { color: Colors.watch, bg: Colors.watchMuted, label: 'Proceed with caution' },
    risky: { color: Colors.warning, bg: Colors.warningMuted, label: 'Risky' },
};

function RiskFactorCard({ factor }: { factor: RiskFactor }) {
    const meta = SEVERITY_META[factor.severity];
    return (
        <Card style={styles.factorCard}>
            <View style={styles.factorHeader}>
                <View style={[styles.severityDot, { backgroundColor: meta.bg }]}>
                    <Ionicons name="alert" size={14} color={meta.color} />
                </View>
                <Text style={styles.factorTitle}>{factor.title}</Text>
                <View style={[styles.severityPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.severityPillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
            </View>
            <Text style={styles.factorMessage}>{factor.message}</Text>
            <View style={styles.recRow}>
                <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
                <Text style={styles.factorRec}>{factor.recommendation}</Text>
            </View>
        </Card>
    );
}

export default function RiskDecisionScreen() {
    const { household, transactions, accounts, debts, budgets, categories, goals, incomeSources, members, recurringBills } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const period = currentPeriod();
    const [tab, setTab] = useState<Tab>('risk');

    const cashFlow = useMemo(() => computeCashFlowSummary(transactions, accounts, recurringBills, period), [transactions, accounts, recurringBills, period]);
    const budgetLines = useMemo(() => computeBudgetLines(budgets, categories, transactions, period), [budgets, categories, transactions, period]);
    const goalPaces = useMemo(() => computeAllGoalPaces(goals, symbol), [goals, symbol]);
    const incomeConcentration = useMemo(() => computeIncomeConcentration(transactions, incomeSources), [transactions, incomeSources]);
    const riskReport = useMemo(
        () => computeRiskReport(transactions, accounts, debts, budgetLines, goalPaces, cashFlow, incomeConcentration, members, symbol),
        [transactions, accounts, debts, budgetLines, goalPaces, cashFlow, incomeConcentration, members, symbol],
    );
    const avgExpense = useMemo(() => averageMonthlyExpense(transactions, 3) || cashFlow.expense, [transactions, cashFlow.expense]);
    const levelMeta = LEVEL_META[riskReport.overallLevel];

    // Decision simulator state
    const [decisionType, setDecisionType] = useState<DecisionType>('new_expense');
    const [label, setLabel] = useState('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [oneTimeAmount, setOneTimeAmount] = useState('');
    const [termMonths, setTermMonths] = useState('');
    const [impact, setImpact] = useState<DecisionImpact | null>(null);

    const canSimulate = decisionType === 'one_time_purchase'
        ? parseFloat(oneTimeAmount) > 0
        : !Number.isNaN(parseFloat(monthlyAmount)) && parseFloat(monthlyAmount) !== 0;

    const handleSimulate = () => {
        if (!canSimulate) return;
        const result = simulateDecision(
            {
                type: decisionType,
                label: label.trim() || 'this decision',
                monthlyAmount: parseFloat(monthlyAmount) || 0,
                oneTimeAmount: parseFloat(oneTimeAmount) || 0,
                termMonths: termMonths ? parseInt(termMonths, 10) : undefined,
            },
            cashFlow, riskReport.liquidCash, avgExpense, symbol,
        );
        setImpact(result);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Risk & Decisions" subtitle="What could go wrong, and what should we do?" />
            <View style={styles.tabRow}>
                {(['risk', 'decisions'] as Tab[]).map((t) => (
                    <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabChip, tab === t && styles.tabChipActive]}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'risk' ? 'Risk Analysis' : 'Decision Simulator'}</Text>
                    </Pressable>
                ))}
            </View>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {tab === 'risk' ? (
                    <>
                        <Card style={[styles.levelCard, { backgroundColor: levelMeta.bg, borderColor: levelMeta.color }]}>
                            <Text style={[styles.levelLabel, { color: levelMeta.color }]}>{levelMeta.label}</Text>
                            <Text style={styles.levelSub}>{riskReport.factors.length} factor{riskReport.factors.length === 1 ? '' : 's'} identified · {riskReport.emergencyFundMonths.toFixed(1)} months of cash reserve</Text>
                        </Card>
                        {riskReport.factors.length === 0 ? (
                            <EmptyState icon="shield-checkmark-outline" title="No significant risks flagged" message="Based on your current cash flow, debts, and budgets, nothing stands out right now." />
                        ) : (
                            riskReport.factors.map((f) => <RiskFactorCard key={f.id} factor={f} />)
                        )}
                    </>
                ) : (
                    <>
                        <Card style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>What are you considering?</Text>
                            <View style={styles.chipWrap}>
                                {DECISION_OPTIONS.map((opt) => (
                                    <Pressable key={opt.type} onPress={() => { setDecisionType(opt.type); setImpact(null); }} style={[styles.chip, decisionType === opt.type && styles.chipActive]}>
                                        <Ionicons name={opt.icon} size={14} color={decisionType === opt.type ? Colors.primary : Colors.textMuted} />
                                        <Text style={[styles.chipText, decisionType === opt.type && styles.chipTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <FormField label="What is it?" placeholder='e.g. "New car", "Second job", "School fees loan"' value={label} onChangeText={setLabel} />

                            {decisionType === 'one_time_purchase' ? (
                                <FormField label={`One-time cost (${symbol})`} placeholder="0" keyboardType="decimal-pad" value={oneTimeAmount} onChangeText={setOneTimeAmount} />
                            ) : (
                                <FormField
                                    label={decisionType === 'income_change' ? `Monthly income change (${symbol}, negative for a cut)` : `Monthly cost (${symbol})`}
                                    placeholder="0"
                                    keyboardType="numbers-and-punctuation"
                                    value={monthlyAmount}
                                    onChangeText={setMonthlyAmount}
                                />
                            )}
                            {decisionType === 'new_debt' && (
                                <FormField label="Term (months, optional)" placeholder="e.g. 24" keyboardType="number-pad" value={termMonths} onChangeText={setTermMonths} />
                            )}

                            <Button label="Simulate impact" onPress={handleSimulate} disabled={!canSimulate} />
                        </Card>

                        {impact && (
                            <Card style={[styles.verdictCard, { backgroundColor: VERDICT_META[impact.verdict].bg, borderColor: VERDICT_META[impact.verdict].color }]}>
                                <Text style={[styles.verdictLabel, { color: VERDICT_META[impact.verdict].color }]}>{VERDICT_META[impact.verdict].label}</Text>
                                <Text style={styles.impactNarrative}>{impact.narrative}</Text>

                                <View style={styles.statGrid}>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>Surplus</Text>
                                        <Text style={styles.statValue}>{formatMoney(impact.currentSurplus, symbol)} → {formatMoney(impact.projectedSurplus, symbol)}</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>Savings rate</Text>
                                        <Text style={styles.statValue}>{impact.currentSavingsRatePct.toFixed(0)}% → {impact.projectedSavingsRatePct.toFixed(0)}%</Text>
                                    </View>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>Emergency fund</Text>
                                        <Text style={styles.statValue}>{impact.emergencyFundMonthsBefore.toFixed(1)}mo → {impact.emergencyFundMonthsAfter.toFixed(1)}mo</Text>
                                    </View>
                                </View>

                                <View style={styles.recRow}>
                                    <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.factorRec}>{impact.recommendation}</Text>
                                </View>
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
    levelCard: { gap: 4, borderWidth: 1 },
    levelLabel: { fontSize: 16, fontWeight: '800' },
    levelSub: { color: Colors.textMuted, fontSize: 12 },
    factorCard: { gap: Spacing.sm },
    factorHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    severityDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    factorTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
    severityPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    severityPillText: { fontSize: 10, fontWeight: '800' },
    factorMessage: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
    recRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    factorRec: { color: Colors.text, fontSize: 12, lineHeight: 17, flex: 1 },
    sectionCard: { gap: Spacing.md },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    chipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: Colors.primary },
    verdictCard: { gap: Spacing.md, borderWidth: 1 },
    verdictLabel: { fontSize: 16, fontWeight: '800' },
    impactNarrative: { color: Colors.text, fontSize: 13, lineHeight: 19 },
    statGrid: { flexDirection: 'row', gap: Spacing.sm },
    statBox: { flex: 1, gap: 2 },
    statLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    statValue: { color: Colors.text, fontSize: 12, fontWeight: '700' },
});
