import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import InsightCard from '../components/InsightCard';
import QuickAddRow from '../components/QuickAddRow';
import { Card, EmptyState } from '../components/ui';
import { Colors, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { generateIncomeInsights, computeIncomeConcentration } from '../intelligence/income';
import { formatMoney } from '../utils/currency';

export default function IncomeInsightsScreen() {
    const { household, transactions, incomeSources, addIncomeSource, members } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const insights = useMemo(() => generateIncomeInsights(transactions, incomeSources, symbol), [transactions, incomeSources, symbol]);
    const concentration = useMemo(() => computeIncomeConcentration(transactions, incomeSources), [transactions, incomeSources]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Income Intelligence" subtitle="How can this household improve its financial capacity?" />
            <ScrollView contentContainerStyle={styles.container}>
                {concentration && (
                    <Card style={styles.concentrationCard}>
                        <Text style={styles.concentrationLabel}>Top income source</Text>
                        <Text style={styles.concentrationValue}>{concentration.topSourceName}</Text>
                        <Text style={styles.concentrationSub}>{concentration.topSourceSharePct.toFixed(0)}% of total income over the last 6 months ({formatMoney(concentration.totalIncome, symbol)})</Text>
                    </Card>
                )}

                <Card>
                    <Text style={styles.sectionTitle}>Opportunities</Text>
                    {insights.length === 0 && <EmptyState icon="rocket-outline" title="Not enough history yet" message="Log income for a couple of months and tag it by source — the engine will look for concentration risk and recurring patterns." />}
                    {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
                </Card>

                <Card style={styles.sectionCard}>
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
    concentrationCard: { gap: 4 },
    concentrationLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    concentrationValue: { color: Colors.text, fontSize: 18, fontWeight: '800' },
    concentrationSub: { color: Colors.textMuted, fontSize: 12 },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    sectionCard: { gap: Spacing.sm },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    sourceName: { color: Colors.text, fontSize: 13, flex: 1 },
    sourceTag: { color: Colors.textFaint, fontSize: 11, fontWeight: '600' },
    recurringToggleRow: { flexDirection: 'row', gap: Spacing.sm },
    toggleChip: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    toggleChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    toggleText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    toggleTextActive: { color: Colors.primary },
});
