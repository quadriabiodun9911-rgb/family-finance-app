import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/ScreenHeader';
import InsightCard from '../components/InsightCard';
import QuickAddRow from '../components/QuickAddRow';
import { Card, EmptyState, ProgressBar, Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useActionSheet } from '../context/ActionSheetContext';
import { generateIncomeInsights, computeIncomeConcentration } from '../intelligence/income';
import { computeCashFlowSummary } from '../intelligence/cashFlow';
import { averageMonthlyExpense } from '../intelligence/risk';
import {
    computeActualAllocation, recommendAllocationSplit, generateAllocationInsights,
    categoryJar, JarKey, JAR_LABELS,
} from '../intelligence/incomeAllocation';
import { formatMoney } from '../utils/currency';
import { currentPeriod } from '../utils/date';
import { CategoryType } from '../types';

const JAR_ICONS: Record<JarKey, any> = { expenses: 'cart', savings: 'trending-up', emergency: 'shield-checkmark' };
const JAR_COLORS: Record<JarKey, string> = { expenses: Colors.primary, savings: Colors.good, emergency: Colors.watch };
const SEVERITY_COLOR = { good: Colors.good, watch: Colors.watch, warning: Colors.warning };

// Income Intelligence (where income comes from, and where it's at risk) and
// Income Allocation (what should happen to it once it arrives) used to live
// on two separate screens you had to navigate between -- one scroll, one
// story: understand the income first, then plan where it goes. Both halves
// keep their own original logic verbatim; this only merges the presentation.
export default function IncomeScreen() {
    const {
        household, transactions, incomeSources, addIncomeSource, members,
        accounts, recurringBills, debts, categories,
        updateAllocationTarget, updateCategory, addCategory,
    } = useFinance();
    const { notice } = useActionSheet();
    const symbol = household?.currencySymbol || '$';
    const period = currentPeriod();

    // ── Income Intelligence ─────────────────────────────────────────────
    const incomeInsights = useMemo(() => generateIncomeInsights(transactions, incomeSources, symbol), [transactions, incomeSources, symbol]);
    const concentration = useMemo(() => computeIncomeConcentration(transactions, incomeSources), [transactions, incomeSources]);

    // ── Income Allocation ────────────────────────────────────────────────
    const cashFlow = useMemo(() => computeCashFlowSummary(transactions, accounts, recurringBills, period), [transactions, accounts, recurringBills, period]);
    const actual = useMemo(() => computeActualAllocation(transactions, categories, period), [transactions, categories, period]);

    const liquidCash = accounts.reduce((s, a) => s + a.balance, 0);
    const avgExpense = averageMonthlyExpense(transactions, 3) || cashFlow.expense;
    const emergencyFundMonths = avgExpense > 0 ? liquidCash / avgExpense : (liquidCash > 0 ? 99 : 0);
    const monthlyDebtPayments = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
    const debtToIncomeRatio = cashFlow.income > 0 ? monthlyDebtPayments / cashFlow.income : 0;
    const recommendation = useMemo(() => recommendAllocationSplit(emergencyFundMonths, debtToIncomeRatio), [emergencyFundMonths, debtToIncomeRatio]);

    const target = {
        expensesPct: household?.allocExpensesPct ?? 50,
        savingsPct: household?.allocSavingsPct ?? 30,
        emergencyPct: household?.allocEmergencyPct ?? 20,
    };
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftExpenses, setDraftExpenses] = useState(String(target.expensesPct));
    const [draftSavings, setDraftSavings] = useState(String(target.savingsPct));
    const [draftEmergency, setDraftEmergency] = useState(String(target.emergencyPct));

    const allocationInsights = useMemo(() => generateAllocationInsights(target, actual, cashFlow.income, symbol), [target, actual, cashFlow.income, symbol]);

    const startEditing = () => {
        setDraftExpenses(String(target.expensesPct));
        setDraftSavings(String(target.savingsPct));
        setDraftEmergency(String(target.emergencyPct));
        setEditing(true);
    };
    const draftSum = (parseFloat(draftExpenses) || 0) + (parseFloat(draftSavings) || 0) + (parseFloat(draftEmergency) || 0);
    const draftValid = Math.abs(draftSum - 100) < 0.5;
    const saveDraft = async () => {
        if (!draftValid) return;
        setSaving(true);
        const result = await updateAllocationTarget(parseFloat(draftExpenses) || 0, parseFloat(draftSavings) || 0, parseFloat(draftEmergency) || 0);
        setSaving(false);
        if (result.error) { notice({ title: 'Could not save', message: result.error }); return; }
        setEditing(false);
    };
    const applyRecommendation = async () => {
        setSaving(true);
        const result = await updateAllocationTarget(recommendation.expensesPct, recommendation.savingsPct, recommendation.emergencyPct);
        setSaving(false);
        if (result.error) { notice({ title: 'Could not save', message: result.error }); return; }
        setEditing(false);
    };

    const expenseCategories = categories.filter((c) => c.type === 'expense' as CategoryType);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryJar, setNewCategoryJar] = useState<JarKey>('emergency');
    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        addCategory({ name: newCategoryName.trim(), type: 'expense', icon: JAR_ICONS[newCategoryJar], color: JAR_COLORS[newCategoryJar], jar: newCategoryJar });
        setNewCategoryName('');
    };

    const jars: JarKey[] = ['expenses', 'savings', 'emergency'];

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Income" subtitle="Where it comes from, how it's trending, and where it should go" />
            <ScrollView contentContainerStyle={styles.container}>
                {/* ── Income Intelligence ─────────────────────────────── */}
                <View style={styles.zoneHeaderRow}>
                    <Ionicons name="rocket" size={14} color={Colors.primary} />
                    <Text style={styles.zoneHeader}>INCOME INTELLIGENCE</Text>
                </View>

                {concentration && (
                    <Card style={styles.concentrationCard}>
                        <Text style={styles.concentrationLabel}>Top income source</Text>
                        <Text style={styles.concentrationValue}>{concentration.topSourceName}</Text>
                        <Text style={styles.concentrationSub}>{concentration.topSourceSharePct.toFixed(0)}% of total income over the last 6 months ({formatMoney(concentration.totalIncome, symbol)})</Text>
                    </Card>
                )}

                <Card>
                    <Text style={styles.sectionTitle}>Opportunities</Text>
                    {incomeInsights.length === 0 && <EmptyState icon="rocket-outline" title="Not enough history yet" message="Log income for a couple of months and tag it by source — the engine will look for concentration risk and recurring patterns." />}
                    {incomeInsights.map((i) => <InsightCard key={i.id} insight={i} />)}
                </Card>

                <Card>
                    <Text style={styles.sectionTitle}>Income sources</Text>
                    {incomeSources.map((s) => (
                        <View key={s.id} style={styles.sourceRow}>
                            <Ionicons name={s.isRecurring ? 'repeat' : 'shuffle'} size={14} color={Colors.textMuted} />
                            <Text style={styles.sourceName}>{s.name}</Text>
                            <Text style={styles.sourceTag}>{s.isRecurring ? 'Recurring' : 'Irregular'}</Text>
                        </View>
                    ))}
                    <QuickAddRowSource onAdd={(name, isRecurring) => addIncomeSource({ name, isPrimary: incomeSources.length === 0, isRecurring, memberId: members[0]?.id })} />
                </Card>

                {/* ── Income Allocation ───────────────────────────────── */}
                <View style={[styles.zoneHeaderRow, styles.zoneHeaderRowSpaced]}>
                    <Ionicons name="pie-chart" size={14} color={Colors.primary} />
                    <Text style={styles.zoneHeader}>INCOME ALLOCATION</Text>
                </View>

                <Card style={styles.recCard}>
                    <View style={styles.recHeader}>
                        <Ionicons name="bulb" size={16} color={Colors.primary} />
                        <Text style={styles.recTitle}>Recommended split</Text>
                    </View>
                    <Text style={styles.recSplit}>{recommendation.expensesPct}% · {recommendation.savingsPct}% · {recommendation.emergencyPct}%</Text>
                    <Text style={styles.recRationale}>{recommendation.rationale}</Text>
                    <Button label="Use this split" variant="secondary" onPress={applyRecommendation} loading={saving} />
                </Card>

                <View style={styles.jarsRow}>
                    {jars.map((jar) => {
                        const pct = jar === 'expenses' ? target.expensesPct : jar === 'savings' ? target.savingsPct : target.emergencyPct;
                        const targetAmount = (pct / 100) * cashFlow.income;
                        const actualAmount = actual[jar];
                        const pctOfTarget = targetAmount > 0 ? Math.min(150, (actualAmount / targetAmount) * 100) : 0;
                        const insight = allocationInsights.find((i) => i.jar === jar);
                        return (
                            <Card key={jar} style={styles.jarCard}>
                                <View style={[styles.jarIconWrap, { backgroundColor: JAR_COLORS[jar] + '26' }]}>
                                    <Ionicons name={JAR_ICONS[jar]} size={18} color={JAR_COLORS[jar]} />
                                </View>
                                <Text style={styles.jarLabel}>{JAR_LABELS[jar]}</Text>
                                <Text style={styles.jarPct}>{pct}%</Text>
                                <Text style={styles.jarAmounts}>{formatMoney(actualAmount, symbol)} <Text style={styles.jarOf}>of {formatMoney(targetAmount, symbol)}</Text></Text>
                                <ProgressBar pct={pctOfTarget} color={insight?.severity === 'warning' ? Colors.warning : insight?.severity === 'watch' ? Colors.watch : Colors.good} height={6} />
                                {insight && (
                                    <Text style={[styles.jarInsight, { color: SEVERITY_COLOR[insight.severity] }]}>{insight.message}</Text>
                                )}
                            </Card>
                        );
                    })}
                </View>

                <Card style={styles.targetCard}>
                    <View style={styles.targetHeader}>
                        <Text style={styles.sectionTitle}>Your target split</Text>
                        {!editing && (
                            <Pressable onPress={startEditing}><Text style={styles.editLink}>Edit</Text></Pressable>
                        )}
                    </View>
                    {editing ? (
                        <>
                            <View style={styles.editRow}>
                                <Text style={styles.editLabel}>Expenses %</Text>
                                <TextInput style={styles.editInput} keyboardType="number-pad" value={draftExpenses} onChangeText={setDraftExpenses} />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.editLabel}>Savings & Investment %</Text>
                                <TextInput style={styles.editInput} keyboardType="number-pad" value={draftSavings} onChangeText={setDraftSavings} />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.editLabel}>Emergency %</Text>
                                <TextInput style={styles.editInput} keyboardType="number-pad" value={draftEmergency} onChangeText={setDraftEmergency} />
                            </View>
                            {!draftValid && <Text style={styles.errorText}>Must add up to 100% (currently {draftSum}%).</Text>}
                            <View style={styles.editActions}>
                                <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                                <Button label="Save" onPress={saveDraft} disabled={!draftValid} loading={saving} style={{ flex: 1 }} />
                            </View>
                        </>
                    ) : (
                        <Text style={styles.targetSummary}>{target.expensesPct}% Expenses · {target.savingsPct}% Savings & Investment · {target.emergencyPct}% Emergency</Text>
                    )}
                </Card>

                <Card style={styles.catCard}>
                    <Text style={styles.sectionTitle}>Categorize your spending</Text>
                    <Text style={styles.catHint}>Which jar does each expense category count toward?</Text>
                    {expenseCategories.map((c) => (
                        <View key={c.id} style={styles.catRow}>
                            <Ionicons name={c.icon as any} size={16} color={c.color} />
                            <Text style={styles.catName}>{c.name}</Text>
                            <View style={styles.jarPicker}>
                                {jars.map((jar) => (
                                    <Pressable
                                        key={jar}
                                        onPress={() => updateCategory(c.id, { jar })}
                                        style={[styles.jarPickerChip, categoryJar(c) === jar && { backgroundColor: JAR_COLORS[jar] + '33', borderColor: JAR_COLORS[jar] }]}
                                    >
                                        <Text style={[styles.jarPickerText, categoryJar(c) === jar && { color: JAR_COLORS[jar] }]}>{jar === 'expenses' ? 'Exp' : jar === 'savings' ? 'Sav' : 'Emg'}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ))}

                    <View style={styles.addCatRow}>
                        <FormField label="New category" placeholder="e.g. School Fees Fund" value={newCategoryName} onChangeText={setNewCategoryName} style={{ flex: 1 }} />
                        <View style={styles.jarPicker}>
                            {jars.map((jar) => (
                                <Pressable key={jar} onPress={() => setNewCategoryJar(jar)} style={[styles.jarPickerChip, newCategoryJar === jar && { backgroundColor: JAR_COLORS[jar] + '33', borderColor: JAR_COLORS[jar] }]}>
                                    <Text style={[styles.jarPickerText, newCategoryJar === jar && { color: JAR_COLORS[jar] }]}>{jar === 'expenses' ? 'Exp' : jar === 'savings' ? 'Sav' : 'Emg'}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                    <Button label="Add category" variant="secondary" onPress={handleAddCategory} disabled={!newCategoryName.trim()} />
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

function QuickAddRowSource({ onAdd }: { onAdd: (name: string, isRecurring: boolean) => void }) {
    const [recurring, setRecurring] = useState(true);
    return (
        <View style={{ gap: Spacing.sm }}>
            <View style={styles.recurringToggleRow}>
                <Pressable style={[styles.toggleChip, recurring && styles.toggleChipActive]} onPress={() => setRecurring(true)}>
                    <Text style={[styles.toggleText, recurring && styles.toggleTextActive]}>Recurring</Text>
                </Pressable>
                <Pressable style={[styles.toggleChip, !recurring && styles.toggleChipActive]} onPress={() => setRecurring(false)}>
                    <Text style={[styles.toggleText, !recurring && styles.toggleTextActive]}>Irregular</Text>
                </Pressable>
            </View>
            <QuickAddRow namePlaceholder="e.g. Freelance design" amountPlaceholder="" showAmount={false} onAdd={(name) => onAdd(name, recurring)} />
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },

    zoneHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: -Spacing.xs },
    zoneHeaderRowSpaced: { marginTop: Spacing.sm },
    zoneHeader: { color: Colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

    concentrationCard: { gap: 4 },
    concentrationLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    concentrationValue: { color: Colors.text, fontSize: 18, fontWeight: '800' },
    concentrationSub: { color: Colors.textMuted, fontSize: 12 },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    sourceName: { color: Colors.text, fontSize: 13, flex: 1 },
    sourceTag: { color: Colors.textFaint, fontSize: 11, fontWeight: '600' },
    recurringToggleRow: { flexDirection: 'row', gap: Spacing.sm },
    toggleChip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    toggleChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    toggleText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    toggleTextActive: { color: Colors.primary },

    recCard: { gap: Spacing.sm },
    recHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    recTitle: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    recSplit: { color: Colors.text, fontSize: 18, fontWeight: '800' },
    recRationale: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
    jarsRow: { gap: Spacing.sm },
    jarCard: { gap: 4 },
    jarIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    jarLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    jarPct: { color: Colors.textFaint, fontSize: 11, fontWeight: '700', position: 'absolute', right: Spacing.md, top: Spacing.md },
    jarAmounts: { color: Colors.text, fontSize: 15, fontWeight: '800' },
    jarOf: { color: Colors.textFaint, fontSize: 12, fontWeight: '500' },
    jarInsight: { fontSize: 12, lineHeight: 17, marginTop: 2 },
    targetCard: { gap: Spacing.sm },
    targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    editLink: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
    targetSummary: { color: Colors.textMuted, fontSize: 13 },
    editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    editLabel: { color: Colors.textMuted, fontSize: 13 },
    editInput: { width: 70, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.text, textAlign: 'right' },
    errorText: { color: Colors.warning, fontSize: 12 },
    editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    catCard: { gap: Spacing.sm },
    catHint: { color: Colors.textFaint, fontSize: 12, marginTop: -4 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    catName: { color: Colors.text, fontSize: 13, flex: 1 },
    jarPicker: { flexDirection: 'row', gap: 4 },
    jarPickerChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    jarPickerText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
    addCatRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
});
