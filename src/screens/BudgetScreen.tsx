import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, ProgressBar, EmptyState } from '../components/ui';
import InsightCard from '../components/InsightCard';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeBudgetLines, generateBudgetInsights, BudgetLine } from '../intelligence/budgetPlan';
import { formatMoney } from '../utils/currency';
import { currentPeriod, periodLabel, shiftPeriod } from '../utils/date';

export default function BudgetScreen() {
    const { household, budgets, categories, transactions, setBudget } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [period, setPeriod] = useState(currentPeriod());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const lines = useMemo(() => computeBudgetLines(budgets, categories, transactions, period), [budgets, categories, transactions, period]);
    const insights = useMemo(() => generateBudgetInsights(lines, symbol), [lines, symbol]);
    const unbudgeted = categories.filter((c) => c.type === 'expense' && !budgets.some((b) => b.categoryId === c.id && b.period === period));

    const totals = lines.reduce((acc, l) => ({ planned: acc.planned + l.planned, actual: acc.actual + l.actual, projected: acc.projected + l.projectedTotal }), { planned: 0, actual: 0, projected: 0 });

    const startEdit = (categoryId: string, current?: number) => {
        setEditingId(categoryId);
        setEditValue(current ? String(current) : '');
    };
    const saveEdit = (categoryId: string) => {
        const value = parseFloat(editValue);
        if (!Number.isNaN(value) && value >= 0) setBudget(categoryId, period, value);
        setEditingId(null);
        setEditValue('');
    };

    const paceColor = (line: BudgetLine) => line.paceStatus === 'over' ? Colors.warning : line.paceStatus === 'watch' ? Colors.watch : Colors.good;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => setPeriod(shiftPeriod(period, -1))} hitSlop={10}><Ionicons name="chevron-back" size={20} color={Colors.textMuted} /></Pressable>
                <Text style={styles.title}>{periodLabel(period)}</Text>
                <Pressable onPress={() => setPeriod(shiftPeriod(period, 1))} hitSlop={10}><Ionicons name="chevron-forward" size={20} color={Colors.textMuted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Planned vs Actual</Text>
                    <View style={styles.summaryRow}>
                        <View><Text style={styles.summarySub}>Planned</Text><Text style={styles.summaryValue}>{formatMoney(totals.planned, symbol)}</Text></View>
                        <View><Text style={styles.summarySub}>Actual</Text><Text style={styles.summaryValue}>{formatMoney(totals.actual, symbol)}</Text></View>
                        <View><Text style={styles.summarySub}>Forecast</Text><Text style={[styles.summaryValue, totals.projected > totals.planned && { color: Colors.warning }]}>{formatMoney(totals.projected, symbol)}</Text></View>
                    </View>
                </Card>

                {insights.length > 0 && (
                    <Card>
                        {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
                    </Card>
                )}

                <View style={styles.listWrap}>
                    <Text style={styles.sectionTitle}>Budgeted categories</Text>
                    {lines.length === 0 && <EmptyState icon="pie-chart-outline" title="No budgets set" message="Set a monthly plan below so this screen can warn you mid-month, not after." />}
                    {lines.map((line) => (
                        <Card key={line.category.id} style={styles.lineCard}>
                            <Pressable style={styles.lineHeader} onPress={() => startEdit(line.category.id, line.planned)}>
                                <View style={[styles.catIconWrap, { backgroundColor: line.category.color + '26' }]}>
                                    <Ionicons name={line.category.icon as any} size={16} color={line.category.color} />
                                </View>
                                <Text style={styles.catName}>{line.category.name}</Text>
                                <Text style={styles.catAmounts}>{formatMoney(line.actual, symbol)} / {formatMoney(line.planned, symbol)}</Text>
                            </Pressable>
                            <ProgressBar pct={line.pctUsed} color={paceColor(line)} />
                            <Text style={[styles.paceText, { color: paceColor(line) }]}>
                                {line.pctUsed.toFixed(0)}% used · {line.daysRemaining} day{line.daysRemaining === 1 ? '' : 's'} left
                            </Text>
                            {editingId === line.category.id && (
                                <View style={styles.editRow}>
                                    <TextInput style={styles.editInput} keyboardType="decimal-pad" value={editValue} onChangeText={setEditValue} autoFocus placeholder="Monthly plan amount" placeholderTextColor={Colors.textFaint} />
                                    <Pressable style={styles.saveBtn} onPress={() => saveEdit(line.category.id)}><Text style={styles.saveBtnText}>Save</Text></Pressable>
                                </View>
                            )}
                        </Card>
                    ))}
                </View>

                {unbudgeted.length > 0 && (
                    <View style={styles.listWrap}>
                        <Text style={styles.sectionTitle}>Add a plan</Text>
                        {unbudgeted.map((c) => (
                            <Card key={c.id} style={styles.lineCard}>
                                <Pressable style={styles.lineHeader} onPress={() => startEdit(c.id)}>
                                    <View style={[styles.catIconWrap, { backgroundColor: c.color + '26' }]}>
                                        <Ionicons name={c.icon as any} size={16} color={c.color} />
                                    </View>
                                    <Text style={styles.catName}>{c.name}</Text>
                                    <Ionicons name="add-circle-outline" size={18} color={Colors.textMuted} />
                                </Pressable>
                                {editingId === c.id && (
                                    <View style={styles.editRow}>
                                        <TextInput style={styles.editInput} keyboardType="decimal-pad" value={editValue} onChangeText={setEditValue} autoFocus placeholder="Monthly plan amount" placeholderTextColor={Colors.textFaint} />
                                        <Pressable style={styles.saveBtn} onPress={() => saveEdit(c.id)}><Text style={styles.saveBtnText}>Save</Text></Pressable>
                                    </View>
                                )}
                            </Card>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    title: { color: Colors.text, fontSize: 17, fontWeight: '700', minWidth: 160, textAlign: 'center' },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    summaryCard: { gap: Spacing.sm },
    summaryLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summarySub: { color: Colors.textFaint, fontSize: 11 },
    summaryValue: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
    listWrap: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    lineCard: { gap: Spacing.sm },
    lineHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    catIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    catName: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
    catAmounts: { color: Colors.textMuted, fontSize: 12 },
    paceText: { fontSize: 12, fontWeight: '600' },
    editRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    editInput: { flex: 1, minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text },
    saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
