import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/ScreenHeader';
import MiniBarChart from '../components/MiniBarChart';
import InsightCard from '../components/InsightCard';
import CalendarMonth from '../components/CalendarMonth';
import { Card, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeAllCategoryTrends, generateSpendingInsights } from '../intelligence/spending';
import { computeRangeSummary, comparePeriods } from '../intelligence/compare';
import { sumByType } from '../intelligence/cashFlow';
import { formatCompactMoney, formatMoney } from '../utils/currency';
import { addDaysISO, shortWeekday, shortDate, todayISO, last6Periods, periodLabel, currentPeriod, shiftPeriod, daysInMonth } from '../utils/date';

type Range = 'daily' | 'weekly' | 'monthly';
type TopTab = 'trends' | 'compare';
type RangeKey = 'A' | 'B';
interface DateRange { start: string | null; end: string | null }

export default function AnalysisScreen() {
    const { household, transactions, categories, incomeSources } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [topTab, setTopTab] = useState<TopTab>('trends');
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
        // Oldest to newest, left to right -- matching dailyData and
        // monthlyData below. i=0 is 5 weeks ago, i=5 is this week.
        return Array.from({ length: 6 }, (_, i) => {
            const weeksAgo = 5 - i;
            const end = addDaysISO(todayISO(), -7 * weeksAgo);
            const start = addDaysISO(end, -6);
            const tx = transactions.filter((t) => t.date >= start && t.date <= end);
            return { label: weeksAgo === 0 ? 'This wk' : `-${weeksAgo}w`, value: sumByType(tx, 'expense') };
        });
    }, [transactions]);

    const monthlyData = useMemo(() => last6Periods().map((p) => {
        const tx = transactions.filter((t) => t.date.slice(0, 7) === p);
        return { label: periodLabel(p).slice(0, 3), value: sumByType(tx, 'expense') };
    }), [transactions]);

    const chartData = range === 'daily' ? dailyData : range === 'weekly' ? weeklyData : monthlyData;

    const topCategories = useMemo(() => {
        return [...trends].sort((a, b) => b.latestTotal - a.latestTotal).filter((t) => t.latestTotal > 0).slice(0, 6);
    }, [trends]);

    // ─── Compare (calendar-based period comparison) ────────────────────────
    const [activeRangeKey, setActiveRangeKey] = useState<RangeKey>('A');
    const [rangeA, setRangeA] = useState<DateRange>({ start: null, end: null });
    const [rangeB, setRangeB] = useState<DateRange>({ start: null, end: null });
    const [calendarPeriod, setCalendarPeriod] = useState(currentPeriod());

    const activeRange = activeRangeKey === 'A' ? rangeA : rangeB;
    const setActiveRange = activeRangeKey === 'A' ? setRangeA : setRangeB;

    const handleSelectDate = (date: string) => {
        setActiveRange((prev) => {
            if (!prev.start || (prev.start && prev.end)) return { start: date, end: null };
            if (date < prev.start) return { start: date, end: null };
            return { start: prev.start, end: date };
        });
    };

    const applyThisVsLastMonth = () => {
        const cur = currentPeriod();
        const prev = shiftPeriod(cur, -1);
        setRangeA({ start: `${prev}-01`, end: `${prev}-${String(daysInMonth(prev)).padStart(2, '0')}` });
        setRangeB({ start: `${cur}-01`, end: todayISO() });
        setCalendarPeriod(cur);
    };
    const applyThisVsLastWeek = () => {
        const end = todayISO();
        const start = addDaysISO(end, -6);
        const priorEnd = addDaysISO(start, -1);
        const priorStart = addDaysISO(priorEnd, -6);
        setRangeA({ start: priorStart, end: priorEnd });
        setRangeB({ start, end });
        setCalendarPeriod(end.slice(0, 7));
    };

    const rangeLabel = (r: DateRange) => (r.start && r.end ? `${shortDate(r.start)} – ${shortDate(r.end)}` : r.start ? `${shortDate(r.start)} – …` : 'Tap dates below');

    const comparison = useMemo(() => {
        if (!rangeA.start || !rangeA.end || !rangeB.start || !rangeB.end) return null;
        const a = computeRangeSummary(transactions, categories, rangeA.start, rangeA.end, rangeLabel(rangeA));
        const b = computeRangeSummary(transactions, categories, rangeB.start, rangeB.end, rangeLabel(rangeB));
        return comparePeriods(a, b);
    }, [rangeA, rangeB, transactions, categories]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Spending Analysis" subtitle="Not just what changed — why" />
            <View style={styles.topTabRow}>
                {(['trends', 'compare'] as TopTab[]).map((t) => (
                    <Pressable key={t} onPress={() => setTopTab(t)} style={[styles.topTabChip, topTab === t && styles.topTabChipActive]}>
                        <Text style={[styles.topTabText, topTab === t && styles.topTabTextActive]}>{t === 'trends' ? 'Trends' : 'Compare'}</Text>
                    </Pressable>
                ))}
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                {topTab === 'trends' ? (
                    <>
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
                    </>
                ) : (
                    <>
                        <Card style={styles.presetCard}>
                            <Text style={styles.sectionTitle}>Quick compare</Text>
                            <View style={styles.presetRow}>
                                <Pressable style={styles.presetBtn} onPress={applyThisVsLastWeek}>
                                    <Text style={styles.presetBtnText}>This week vs last</Text>
                                </Pressable>
                                <Pressable style={styles.presetBtn} onPress={applyThisVsLastMonth}>
                                    <Text style={styles.presetBtnText}>This month vs last</Text>
                                </Pressable>
                            </View>
                        </Card>

                        <Card style={styles.calendarCard}>
                            <Text style={styles.sectionTitle}>Or pick two custom ranges</Text>
                            <View style={styles.rangeToggleRow}>
                                {(['A', 'B'] as RangeKey[]).map((key) => (
                                    <Pressable key={key} onPress={() => setActiveRangeKey(key)} style={[styles.rangeToggleChip, activeRangeKey === key && styles.rangeToggleChipActive]}>
                                        <Text style={[styles.rangeToggleLabel, activeRangeKey === key && styles.rangeToggleLabelActive]}>Range {key}</Text>
                                        <Text style={[styles.rangeToggleValue, activeRangeKey === key && styles.rangeToggleValueActive]}>{rangeLabel(key === 'A' ? rangeA : rangeB)}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.calendarHint}>Tap a start date, then an end date, for Range {activeRangeKey}.</Text>
                            <CalendarMonth
                                period={calendarPeriod}
                                onPeriodChange={setCalendarPeriod}
                                startDate={activeRange.start}
                                endDate={activeRange.end}
                                onSelectDate={handleSelectDate}
                            />
                        </Card>

                        {comparison ? (
                            <>
                                <Card style={styles.resultCard}>
                                    <View style={styles.resultHeaderRow}>
                                        <Text style={styles.resultPeriodLabel}>{comparison.a.label}</Text>
                                        <Ionicons name="arrow-forward" size={14} color={Colors.textFaint} />
                                        <Text style={styles.resultPeriodLabel}>{comparison.b.label}</Text>
                                    </View>
                                    <CompareStatRow label="Income" a={comparison.a.income} b={comparison.b.income} deltaPct={comparison.incomeDeltaPct} symbol={symbol} goodDirection="up" />
                                    <CompareStatRow label="Expenses" a={comparison.a.expense} b={comparison.b.expense} deltaPct={comparison.expenseDeltaPct} symbol={symbol} goodDirection="down" />
                                    <View style={styles.surplusRow}>
                                        <Text style={styles.surplusLabel}>Surplus</Text>
                                        <Text style={styles.surplusValue}>{formatMoney(comparison.a.surplus, symbol)} → {formatMoney(comparison.b.surplus, symbol)}</Text>
                                        <Text style={[styles.surplusDelta, { color: comparison.surplusDelta >= 0 ? Colors.good : Colors.warning }]}>
                                            {comparison.surplusDelta >= 0 ? '+' : ''}{formatMoney(comparison.surplusDelta, symbol)}
                                        </Text>
                                    </View>
                                </Card>

                                {comparison.categoryDeltas.length > 0 && (
                                    <Card style={styles.listWrap}>
                                        <Text style={styles.sectionTitle}>Biggest category swings</Text>
                                        {comparison.categoryDeltas.slice(0, 8).map((c) => (
                                            <View key={c.categoryName} style={styles.catRow}>
                                                <Text style={styles.catName}>{c.categoryName}</Text>
                                                <Text style={styles.catValue}>{formatCompactMoney(c.aAmount, symbol)} → {formatCompactMoney(c.bAmount, symbol)}</Text>
                                                {c.deltaPct !== null && (
                                                    <Text style={[styles.catChange, { color: c.deltaPct >= 0 ? Colors.warning : Colors.good }]}>
                                                        {c.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(c.deltaPct).toFixed(0)}%
                                                    </Text>
                                                )}
                                            </View>
                                        ))}
                                    </Card>
                                )}
                            </>
                        ) : (
                            <EmptyState icon="calendar-outline" title="Pick two ranges to compare" message="Use a quick preset above, or tap start and end dates on the calendar for Range A and Range B." />
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function CompareStatRow({ label, a, b, deltaPct, symbol, goodDirection }: {
    label: string; a: number; b: number; deltaPct: number | null; symbol: string; goodDirection: 'up' | 'down';
}) {
    const isUp = deltaPct !== null && deltaPct >= 0;
    const isGood = deltaPct === null ? true : (goodDirection === 'up' ? isUp : !isUp);
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{formatMoney(a, symbol)} → {formatMoney(b, symbol)}</Text>
            {deltaPct !== null && (
                <Text style={[styles.statDelta, { color: isGood ? Colors.good : Colors.warning }]}>{isUp ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(0)}%</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    topTabRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    topTabChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    topTabChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    topTabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    topTabTextActive: { color: Colors.primary },
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
    presetCard: { gap: Spacing.sm },
    presetRow: { flexDirection: 'row', gap: Spacing.sm },
    presetBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    presetBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
    calendarCard: { gap: Spacing.sm },
    rangeToggleRow: { flexDirection: 'row', gap: Spacing.sm },
    rangeToggleChip: { flex: 1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, gap: 2 },
    rangeToggleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
    rangeToggleLabel: { color: Colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    rangeToggleLabelActive: { color: Colors.primary },
    rangeToggleValue: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    rangeToggleValueActive: { color: Colors.text },
    calendarHint: { color: Colors.textFaint, fontSize: 11 },
    resultCard: { gap: Spacing.sm },
    resultHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    resultPeriodLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
    statLabel: { color: Colors.textMuted, fontSize: 12, width: 70 },
    statValue: { color: Colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
    statDelta: { fontSize: 12, fontWeight: '700', minWidth: 54, textAlign: 'right' },
    surplusRow: { paddingTop: Spacing.sm, gap: 2 },
    surplusLabel: { color: Colors.textMuted, fontSize: 12 },
    surplusValue: { color: Colors.text, fontSize: 15, fontWeight: '800' },
    surplusDelta: { fontSize: 12, fontWeight: '700' },
});
