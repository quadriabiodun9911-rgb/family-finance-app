import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { Card, Button, ProgressBar, FormField, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import {
    computeAmortization, computeDebtSummary, compareStrategies, computeMortgageEquity, StrategyComparison,
} from '../intelligence/debt';
import { formatMoney } from '../utils/currency';
import { DebtType } from '../types';

const DEBT_TYPE_META: Record<DebtType, { label: string; icon: any; color: string }> = {
    mortgage: { label: 'Mortgage', icon: 'home', color: '#60a5fa' },
    auto: { label: 'Auto Loan', icon: 'car', color: '#fbbf24' },
    credit_card: { label: 'Credit Card', icon: 'card', color: '#ef4444' },
    student: { label: 'Student Loan', icon: 'school', color: '#a78bfa' },
    personal: { label: 'Personal Loan', icon: 'person', color: '#34d399' },
    other: { label: 'Other', icon: 'ellipsis-horizontal', color: '#94a3b8' },
};

function monthsToLabel(months: number): string {
    if (months < 1) return 'this month';
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (years === 0) return `${rest} month${rest === 1 ? '' : 's'}`;
    if (rest === 0) return `${years} year${years === 1 ? '' : 's'}`;
    return `${years}y ${rest}mo`;
}

export default function DebtIntelligenceScreen() {
    const { household, debts, otherAssets, addDebt, updateDebt, removeDebt } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const summary = useMemo(() => computeDebtSummary(debts), [debts]);
    const equity = useMemo(() => computeMortgageEquity(debts, otherAssets), [debts, otherAssets]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editApr, setEditApr] = useState('');
    const [editPayment, setEditPayment] = useState('');

    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<DebtType>('other');
    const [newBalance, setNewBalance] = useState('');
    const [newOriginal, setNewOriginal] = useState('');
    const [newApr, setNewApr] = useState('');
    const [newPayment, setNewPayment] = useState('');

    const [extraPayment, setExtraPayment] = useState('');
    const [comparison, setComparison] = useState<StrategyComparison | null>(null);

    const startEdit = (id: string, apr?: number, payment?: number) => {
        setEditingId(id);
        setEditApr(apr ? String(apr) : '');
        setEditPayment(payment ? String(payment) : '');
    };
    const saveEdit = (id: string) => {
        const apr = parseFloat(editApr);
        const payment = parseFloat(editPayment);
        updateDebt(id, {
            aprPct: Number.isNaN(apr) ? undefined : apr,
            minPayment: Number.isNaN(payment) ? undefined : payment,
        });
        setEditingId(null);
    };

    const canAdd = newName.trim().length > 0 && parseFloat(newBalance) > 0;
    const handleAdd = () => {
        if (!canAdd) return;
        addDebt({
            name: newName.trim(),
            type: newType,
            balance: parseFloat(newBalance),
            originalPrincipal: newOriginal ? parseFloat(newOriginal) : undefined,
            aprPct: newApr ? parseFloat(newApr) : undefined,
            minPayment: newPayment ? parseFloat(newPayment) : undefined,
        });
        setNewName(''); setNewBalance(''); setNewOriginal(''); setNewApr(''); setNewPayment(''); setNewType('other');
        setShowAddForm(false);
    };

    const handleCompare = () => {
        const extra = parseFloat(extraPayment) || 0;
        setComparison(compareStrategies(debts, extra));
    };

    const confirmDelete = (name: string, id: string) => {
        Alert.alert('Remove debt', `Remove "${name}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeDebt(id) }]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Debt & Mortgage Intelligence" subtitle="Payoff timelines, interest cost, and strategy" />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {debts.length === 0 ? (
                    <EmptyState icon="card-outline" title="No debts tracked" message="Add a mortgage, loan, or credit card below to see payoff projections and strategy comparisons." />
                ) : (
                    <>
                        <Card style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>TOTAL DEBT</Text>
                            <Text style={styles.summaryValue}>{formatMoney(summary.totalBalance, symbol)}</Text>
                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryBox}>
                                    <Text style={styles.boxLabel}>Monthly payments</Text>
                                    <Text style={styles.boxValue}>{formatMoney(summary.totalMonthlyPayments, symbol)}</Text>
                                </View>
                                <View style={styles.summaryBox}>
                                    <Text style={styles.boxLabel}>Avg. interest rate</Text>
                                    <Text style={styles.boxValue}>{summary.weightedAvgAprPct.toFixed(1)}%</Text>
                                </View>
                                <View style={styles.summaryBox}>
                                    <Text style={styles.boxLabel}>Debt-free in</Text>
                                    <Text style={styles.boxValue}>{summary.debtFreeMonths !== null ? monthsToLabel(summary.debtFreeMonths) : '—'}</Text>
                                </View>
                            </View>
                            {summary.totalInterestRemaining !== null && (
                                <Text style={styles.interestNote}>At current minimum payments, you'll pay approximately {formatMoney(summary.totalInterestRemaining, symbol)} more in interest before these are cleared.</Text>
                            )}
                            {summary.nonViableDebts.length > 0 && (
                                <View style={styles.warnBox}>
                                    <Ionicons name="warning" size={14} color={Colors.warning} />
                                    <Text style={styles.warnText}>
                                        {summary.nonViableDebts.map((d) => d.name).join(', ')} {summary.nonViableDebts.length === 1 ? 'has' : 'have'} a minimum payment that doesn't even cover the interest — {summary.nonViableDebts.length === 1 ? 'it' : 'they'} will never shrink at this rate.
                                    </Text>
                                </View>
                            )}
                        </Card>

                        {equity && (
                            <Card style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Home equity</Text>
                                <View style={styles.summaryGrid}>
                                    <View style={styles.summaryBox}>
                                        <Text style={styles.boxLabel}>Property value</Text>
                                        <Text style={styles.boxValue}>{formatMoney(equity.propertyValue, symbol)}</Text>
                                    </View>
                                    <View style={styles.summaryBox}>
                                        <Text style={styles.boxLabel}>Mortgage balance</Text>
                                        <Text style={styles.boxValue}>{formatMoney(equity.mortgageBalance, symbol)}</Text>
                                    </View>
                                    <View style={styles.summaryBox}>
                                        <Text style={styles.boxLabel}>Your equity</Text>
                                        <Text style={[styles.boxValue, { color: equity.equity >= 0 ? Colors.good : Colors.warning }]}>{formatMoney(equity.equity, symbol)}</Text>
                                    </View>
                                </View>
                                <Text style={styles.hint}>From property listed under Other Assets minus mortgage debts.</Text>
                            </Card>
                        )}

                        <View style={styles.listWrap}>
                            <Text style={styles.sectionTitle}>Your debts</Text>
                            {debts.map((d) => {
                                const meta = DEBT_TYPE_META[d.type] || DEBT_TYPE_META.other;
                                const amort = computeAmortization(d.balance, d.aprPct, d.minPayment);
                                const paidPct = d.originalPrincipal && d.originalPrincipal > 0
                                    ? Math.max(0, Math.min(100, ((d.originalPrincipal - d.balance) / d.originalPrincipal) * 100))
                                    : null;
                                return (
                                    <Card key={d.id} style={styles.debtCard}>
                                        <Pressable style={styles.debtHeader} onPress={() => startEdit(d.id, d.aprPct, d.minPayment)} onLongPress={() => confirmDelete(d.name, d.id)}>
                                            <View style={[styles.typeIconWrap, { backgroundColor: meta.color + '26' }]}>
                                                <Ionicons name={meta.icon} size={16} color={meta.color} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.debtName}>{d.name}</Text>
                                                <Text style={styles.debtMeta}>{meta.label}{d.aprPct ? ` · ${d.aprPct}% APR` : ''}</Text>
                                            </View>
                                            <Text style={styles.debtBalance}>{formatMoney(d.balance, symbol)}</Text>
                                        </Pressable>

                                        {paidPct !== null && (
                                            <>
                                                <ProgressBar pct={paidPct} color={Colors.good} />
                                                <Text style={styles.paidText}>{paidPct.toFixed(0)}% paid off</Text>
                                            </>
                                        )}

                                        {editingId === d.id ? (
                                            <View style={styles.editRow}>
                                                <TextInput style={styles.editInput} placeholder="APR %" placeholderTextColor={Colors.textFaint} keyboardType="decimal-pad" value={editApr} onChangeText={setEditApr} />
                                                <TextInput style={styles.editInput} placeholder={`Min payment (${symbol})`} placeholderTextColor={Colors.textFaint} keyboardType="decimal-pad" value={editPayment} onChangeText={setEditPayment} />
                                                <Pressable style={styles.saveBtn} onPress={() => saveEdit(d.id)}><Text style={styles.saveBtnText}>Save</Text></Pressable>
                                            </View>
                                        ) : (
                                            <Text style={styles.amortText}>
                                                {amort.viable
                                                    ? `Paid off in ${monthsToLabel(amort.months!)} · ${formatMoney(amort.totalInterest!, symbol)} in interest remaining`
                                                    : d.minPayment ? "Minimum payment doesn't cover interest — tap to fix" : 'Tap to add interest rate & minimum payment'}
                                            </Text>
                                        )}
                                    </Card>
                                );
                            })}
                            <Text style={styles.hint}>Tap a debt to edit its rate/payment. Long-press to remove.</Text>
                        </View>

                        <Card style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Payoff strategy</Text>
                            <Text style={styles.strategyHint}>Extra you could put toward debt each month, on top of minimums:</Text>
                            <View style={styles.extraRow}>
                                <TextInput style={styles.editInput} placeholder={`Extra per month (${symbol})`} placeholderTextColor={Colors.textFaint} keyboardType="decimal-pad" value={extraPayment} onChangeText={setExtraPayment} />
                                <Pressable style={styles.saveBtn} onPress={handleCompare}><Text style={styles.saveBtnText}>Compare</Text></Pressable>
                            </View>

                            {comparison && (
                                <View style={styles.compareGrid}>
                                    <View style={styles.compareCol}>
                                        <Text style={styles.compareTitle}>Avalanche</Text>
                                        <Text style={styles.compareSub}>Highest interest rate first</Text>
                                        <Text style={styles.compareStat}>Debt-free in {monthsToLabel(comparison.avalanche.months)}</Text>
                                        <Text style={styles.compareStat}>{formatMoney(comparison.avalanche.totalInterestPaid, symbol)} total interest</Text>
                                    </View>
                                    <View style={styles.compareCol}>
                                        <Text style={styles.compareTitle}>Snowball</Text>
                                        <Text style={styles.compareSub}>Smallest balance first</Text>
                                        <Text style={styles.compareStat}>Debt-free in {monthsToLabel(comparison.snowball.months)}</Text>
                                        <Text style={styles.compareStat}>{formatMoney(comparison.snowball.totalInterestPaid, symbol)} total interest</Text>
                                    </View>
                                </View>
                            )}
                            {comparison && comparison.interestSavedAvalancheVsSnowball > 1 && (
                                <Text style={styles.recommendText}>
                                    Avalanche saves you {formatMoney(comparison.interestSavedAvalancheVsSnowball, symbol)} in interest{comparison.monthsSavedAvalancheVsSnowball > 0 ? ` and gets you debt-free ${monthsToLabel(comparison.monthsSavedAvalancheVsSnowball)} sooner` : ''} compared to snowball. Snowball can still be worth it if paying off a small balance fast keeps you motivated.
                                </Text>
                            )}
                        </Card>
                    </>
                )}

                <Card style={styles.sectionCard}>
                    <Pressable style={styles.addToggle} onPress={() => setShowAddForm((v) => !v)}>
                        <Ionicons name={showAddForm ? 'chevron-up' : 'add-circle-outline'} size={18} color={Colors.primary} />
                        <Text style={styles.addToggleText}>{showAddForm ? 'Close' : 'Add a debt'}</Text>
                    </Pressable>
                    {showAddForm && (
                        <View style={{ gap: Spacing.md }}>
                            <View style={styles.chipWrap}>
                                {(Object.keys(DEBT_TYPE_META) as DebtType[]).map((t) => (
                                    <Pressable key={t} onPress={() => setNewType(t)} style={[styles.chip, newType === t && styles.chipActive]}>
                                        <Ionicons name={DEBT_TYPE_META[t].icon} size={13} color={newType === t ? Colors.primary : Colors.textMuted} />
                                        <Text style={[styles.chipText, newType === t && styles.chipTextActive]}>{DEBT_TYPE_META[t].label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <FormField label="Name" placeholder="e.g. Home Mortgage" value={newName} onChangeText={setNewName} />
                            <FormField label={`Current balance (${symbol})`} placeholder="0" keyboardType="decimal-pad" value={newBalance} onChangeText={setNewBalance} />
                            <FormField label={`Original amount (${symbol}, optional)`} placeholder="For tracking % paid off" keyboardType="decimal-pad" value={newOriginal} onChangeText={setNewOriginal} />
                            <FormField label="Interest rate (APR %, optional)" placeholder="e.g. 12.5" keyboardType="decimal-pad" value={newApr} onChangeText={setNewApr} />
                            <FormField label={`Minimum monthly payment (${symbol}, optional)`} placeholder="0" keyboardType="decimal-pad" value={newPayment} onChangeText={setNewPayment} />
                            <Button label="Add debt" onPress={handleAdd} disabled={!canAdd} />
                        </View>
                    )}
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    summaryCard: { gap: Spacing.sm },
    summaryLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
    summaryValue: { color: Colors.text, fontSize: 28, fontWeight: '800' },
    summaryGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    summaryBox: { flex: 1, gap: 2 },
    boxLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    boxValue: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    interestNote: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: Spacing.xs },
    warnBox: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: Colors.warningMuted, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs },
    warnText: { color: Colors.text, fontSize: 12, lineHeight: 17, flex: 1 },
    sectionCard: { gap: Spacing.md },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    hint: { color: Colors.textFaint, fontSize: 11 },
    listWrap: { gap: Spacing.sm },
    debtCard: { gap: Spacing.xs },
    debtHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    typeIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    debtName: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    debtMeta: { color: Colors.textFaint, fontSize: 11 },
    debtBalance: { color: Colors.text, fontSize: 14, fontWeight: '800' },
    paidText: { color: Colors.good, fontSize: 11, fontWeight: '600' },
    amortText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
    editRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    editInput: { flex: 1, minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text },
    saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    strategyHint: { color: Colors.textMuted, fontSize: 12 },
    extraRow: { flexDirection: 'row', gap: Spacing.sm },
    compareGrid: { flexDirection: 'row', gap: Spacing.md },
    compareCol: { flex: 1, gap: 2, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md },
    compareTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' },
    compareSub: { color: Colors.textFaint, fontSize: 10 },
    compareStat: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
    recommendText: { color: Colors.text, fontSize: 12, lineHeight: 18 },
    addToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    addToggleText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    chipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: Colors.primary },
});
