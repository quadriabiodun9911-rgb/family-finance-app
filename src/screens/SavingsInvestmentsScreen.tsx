import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import QuickAddRow from '../components/QuickAddRow';
import { Card, Button } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeNetWorth, netWorthTrend } from '../intelligence/netWorth';
import { formatMoney } from '../utils/currency';
import { InvestmentType } from '../types';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Row({ icon, name, value, symbol, onDelete }: { icon: any; name: string; value: number; symbol: string; onDelete: () => void }) {
    return (
        <Pressable style={styles.row} onLongPress={onDelete}>
            <Ionicons name={icon} size={16} color={Colors.textMuted} />
            <Text style={styles.rowName}>{name}</Text>
            <Text style={styles.rowValue}>{formatMoney(value, symbol)}</Text>
        </Pressable>
    );
}

export default function SavingsInvestmentsScreen() {
    const navigation = useNavigation<Nav>();
    const {
        household, accounts, addAccount, removeAccount,
        goals, investments, addInvestment, removeInvestment,
        debts, removeDebt, otherAssets, addOtherAsset, removeOtherAsset,
        netWorthHistory, recordNetWorthSnapshot,
    } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const breakdown = useMemo(() => computeNetWorth(accounts, goals, investments, otherAssets, debts), [accounts, goals, investments, otherAssets, debts]);
    const trend = useMemo(() => netWorthTrend(netWorthHistory), [netWorthHistory]);
    const savingsGoals = goals.filter((g) => g.type !== 'debt');

    useEffect(() => {
        recordNetWorthSnapshot(breakdown.totalAssets, breakdown.totalLiabilities);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [breakdown.totalAssets, breakdown.totalLiabilities]);

    const confirmDelete = (label: string, fn: () => void) => Alert.alert('Remove', `Remove ${label}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: fn }]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Savings & Investments" subtitle="Net worth, tracked monthly" />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.netWorthCard}>
                    <Text style={styles.netWorthLabel}>NET WORTH</Text>
                    <Text style={styles.netWorthValue}>{formatMoney(breakdown.netWorth, symbol)}</Text>
                    {trend && (
                        <Text style={[styles.trend, { color: trend.deltaAmount >= 0 ? Colors.good : Colors.warning }]}>
                            {trend.deltaAmount >= 0 ? '+' : ''}{formatMoney(trend.deltaAmount, symbol)} ({trend.deltaPct.toFixed(1)}%) vs last month
                        </Text>
                    )}

                    <View style={styles.statementBlock}>
                        <Text style={styles.statementHeading}>Assets</Text>
                        <View style={styles.statementRow}><Text style={styles.statementLabel}>Cash</Text><Text style={styles.statementValue}>{formatMoney(breakdown.cash, symbol)}</Text></View>
                        <View style={styles.statementRow}><Text style={styles.statementLabel}>Savings</Text><Text style={styles.statementValue}>{formatMoney(breakdown.savings, symbol)}</Text></View>
                        <View style={styles.statementRow}><Text style={styles.statementLabel}>Investments</Text><Text style={styles.statementValue}>{formatMoney(breakdown.investments, symbol)}</Text></View>
                        <View style={styles.statementRow}><Text style={styles.statementLabel}>Other assets</Text><Text style={styles.statementValue}>{formatMoney(breakdown.otherAssets, symbol)}</Text></View>
                        <View style={[styles.statementRow, styles.statementTotalRow]}><Text style={styles.statementTotalLabel}>Total Assets</Text><Text style={styles.statementTotalValue}>{formatMoney(breakdown.totalAssets, symbol)}</Text></View>
                    </View>

                    <View style={styles.statementBlock}>
                        <Text style={styles.statementHeading}>Liabilities</Text>
                        {debts.map((d) => (
                            <View key={d.id} style={styles.statementRow}><Text style={styles.statementLabel}>{d.name}</Text><Text style={styles.statementValue}>{formatMoney(d.balance, symbol)}</Text></View>
                        ))}
                        <View style={[styles.statementRow, styles.statementTotalRow]}><Text style={styles.statementTotalLabel}>Total Liabilities</Text><Text style={styles.statementTotalValue}>{formatMoney(breakdown.totalLiabilities, symbol)}</Text></View>
                    </View>
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Cash & bank accounts</Text>
                    {accounts.map((a) => <Row key={a.id} icon="wallet" name={a.name} value={a.balance} symbol={symbol} onDelete={() => confirmDelete(a.name, () => removeAccount(a.id))} />)}
                    <QuickAddRow namePlaceholder="Account name" amountPlaceholder="Balance" onAdd={(name, amount) => addAccount({ name, type: 'bank', balance: amount })} />
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Savings goals</Text>
                    {savingsGoals.length === 0 && <Text style={styles.emptyText}>Create savings goals from the Goals tab.</Text>}
                    {savingsGoals.map((g) => <Row key={g.id} icon="wallet-outline" name={g.title} value={g.currentValue} symbol={symbol} onDelete={() => {}} />)}
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Investments</Text>
                    {investments.map((i) => <Row key={i.id} icon="trending-up" name={i.name} value={i.currentValue} symbol={symbol} onDelete={() => confirmDelete(i.name, () => removeInvestment(i.id))} />)}
                    <QuickAddRow namePlaceholder="e.g. S&P 500 ETF" amountPlaceholder="Current value" onAdd={(name, amount) => addInvestment({ name, type: 'other' as InvestmentType, costBasis: amount, currentValue: amount, purchaseDate: new Date().toISOString().slice(0, 10) })} />
                    <Text style={styles.hint}>Long-press an item to remove it.</Text>
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Debts & liabilities</Text>
                    {debts.map((d) => <Row key={d.id} icon="card" name={d.name} value={d.balance} symbol={symbol} onDelete={() => confirmDelete(d.name, () => removeDebt(d.id))} />)}
                    {debts.length === 0 && <Text style={styles.emptyText}>No debts tracked yet.</Text>}
                    <Button label="Debt & Mortgage Intelligence" variant="secondary" onPress={() => navigation.navigate('DebtIntelligence')} />
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Property & other assets</Text>
                    {otherAssets.map((a) => <Row key={a.id} icon="home" name={a.name} value={a.value} symbol={symbol} onDelete={() => confirmDelete(a.name, () => removeOtherAsset(a.id))} />)}
                    <QuickAddRow namePlaceholder="e.g. Family home" amountPlaceholder="Value" onAdd={(name, amount) => addOtherAsset({ name, type: 'property', value: amount })} />
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    netWorthCard: { gap: Spacing.sm },
    netWorthLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    netWorthValue: { color: Colors.text, fontSize: 32, fontWeight: '800' },
    trend: { fontSize: 13, fontWeight: '600' },
    statementBlock: { marginTop: Spacing.md, gap: 4 },
    statementHeading: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
    statementRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statementLabel: { color: Colors.textMuted, fontSize: 13 },
    statementValue: { color: Colors.text, fontSize: 13, fontWeight: '600' },
    statementTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 4 },
    statementTotalLabel: { color: Colors.text, fontSize: 13, fontWeight: '800' },
    statementTotalValue: { color: Colors.text, fontSize: 13, fontWeight: '800' },
    sectionCard: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    emptyText: { color: Colors.textFaint, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    rowName: { color: Colors.text, fontSize: 13, flex: 1 },
    rowValue: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    hint: { color: Colors.textFaint, fontSize: 11 },
});
