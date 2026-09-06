import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import MiniBarChart from '../components/MiniBarChart';
import InsightCard from '../components/InsightCard';
import { Card, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeAllCategoryTrends, generateSpendingInsights } from '../intelligence/spending';
import { sumByType } from '../intelligence/cashFlow';
import { formatCompactMoney, formatMoney } from '../utils/currency';
import { addDaysISO, shortWeekday, todayISO, last6Periods, periodLabel } from '../utils/date';

type Range = 'daily' | 'weekly' | 'monthly';

export default function AnalysisScreen() {
    const { household, transactions, categories, incomeSources } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [range, setRange] = useState<Range>('weekly');

    const trends = useMemo(() => computeAllCategoryTrends(transactions, categories), [transactions, categories]);
    const spendingInsights = useMemo(() => generateSpendingInsights(trends, symbol), [trends, symbol]);

    const dailyData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO(), -(6 - i)));
        return days.map((d) => {
            const tx = transactions.filter((t) => t.date === d);
            return { label: shortWeekday(d), value: sumByType(tx, 'expense') };
        });
    }, [transactions]);

    const weeklyData = useMemo(() => {
        const weeks = Array.from({ length: 6 }, (_, i) => {
            const end = addDaysISO(todayISO(), -7 * i);
            const start = addDaysISO(end, -6);
            const tx = transactions.filter((t) => t.date >= start && t.date <= end);
            return { label: `W${6 - i}`, value: sumByType(tx, 'expense') };
        });
        return weeks;
    }, [transactions]);

    const monthlyData = useMemo(() => last6Periods().map((p) => {
        const tx = transactions.filter((t) => t.date.slice(0, 7) === p);
        return { label: periodLabel(p).slice(0, 3), value: sumByType(tx, 'expense') };
    }), [transactions]);

    const chartData = range === 'daily' ? dailyData : range === 'weekly' ? weeklyData : monthlyData;

    const topCategories = useMemo(() => {
        return [...trends].sort((a, b) => b.latestTotal - a.latestTotal).filter((t) => t.latestTotal > 0).slice(0, 6);
    }, [trends]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Spending Analysis" subtitle="Not just what changed — why" />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.chartCard}>
                    <View style={styles.rangeRow}>
                        {(['daily', 'weekly', 'monthly'] as Range[]).map((r) => (
                            <Pressable key={r} onPress={() => setRange(r)} style={[styles.rangeChip, range === r && styles.rangeChipActive]}>
                                <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r[0].toUpperCase() + r.slice(1)}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <MiniBarChart data={chartData.map((d) => ({ label: d.label, value: d.value }))} color={Colors.expense} />
                </Card>

                <View style={styles.listWrap}>
                    <Text style={styles.sectionTitle}>Top categories this month</Text>
                    {topCategories.length === 0 && <EmptyState icon="bar-chart-outline" title="Nothing to show yet" message="Add a few expenses to see where your household's money is going." />}
                    {topCategories.map((t) => (
                        <View key={t.category.id} style={styles.catRow}>
                            <Text style={styles.catName}>{t.category.name}</Text>
                            <Text style={styles.catValue}>{formatCompactMoney(t.latestTotal, symbol)}</Text>
                            {t.changePct !== null && (
                                <Text style={[styles.catChange, { color: t.changePct >= 0 ? Colors.warning : Colors.good }]}>
                                    {t.changePct >= 0 ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(0)}%
                                </Text>
                            )}
                        </View>
                    ))}
                </View>

                {spendingInsights.length > 0 && (
                    <Card>
                        <Text style={styles.sectionTitle}>What's driving your spending</Text>
                        {spendingInsights.map((i) => <InsightCard key={i.id} insight={i} />)}
                    </Card>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    chartCard: { gap: Spacing.md },
    rangeRow: { flexDirection: 'row', gap: Spacing.sm },
    rangeChip: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    rangeChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    rangeText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    rangeTextActive: { color: Colors.primary },
    listWrap: { gap: 2 },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
    catName: { color: Colors.text, fontSize: 13, flex: 1 },
    catValue: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    catChange: { fontSize: 12, fontWeight: '700', minWidth: 54, textAlign: 'right' },
});
