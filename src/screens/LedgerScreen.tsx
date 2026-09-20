import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { Card, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeLedger, computeTrialBalance, LedgerEntry, TrialBalanceRow } from '../intelligence/ledger';
import { exportCsv } from '../utils/csvExport';
import { formatMoney } from '../utils/currency';
import { shortDate, formatTimeLabel } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'transactions' | 'trialBalance';

const TYPE_LABEL: Record<TrialBalanceRow['type'], string> = {
    asset: 'Assets', liability: 'Liabilities', income: 'Income', expense: 'Expenses', equity: 'Equity',
};
const TYPE_ORDER: TrialBalanceRow['type'][] = ['asset', 'liability', 'income', 'expense', 'equity'];

function LedgerRow({ entry, symbol, onPress }: { entry: LedgerEntry; symbol: string; onPress: () => void }) {
    const t = entry.transaction;
    return (
        <Pressable style={styles.row} onPress={onPress}>
            <View style={styles.rowMain}>
                <Text style={styles.rowDesc}>{t.description || entry.categoryName}</Text>
                <Text style={styles.rowMeta}>
                    {shortDate(t.date)}{formatTimeLabel(t.time) ? ` · ${formatTimeLabel(t.time)}` : ''} · {entry.categoryName}{entry.accountName !== '—' ? ` · ${entry.accountName}` : ''}
                </Text>
            </View>
            <View style={styles.rowAmounts}>
                <Text style={[styles.rowAmount, { color: entry.credit > 0 ? Colors.income : Colors.expense }]}>
                    {entry.credit > 0 ? '+' : '-'}{formatMoney(entry.credit > 0 ? entry.credit : entry.debit, symbol)}
                </Text>
                {entry.runningBalance !== null && (
                    <Text style={styles.rowBalance}>Bal {formatMoney(entry.runningBalance, symbol)}</Text>
                )}
            </View>
        </Pressable>
    );
}

export default function LedgerScreen() {
    const navigation = useNavigation<Nav>();
    const { household, transactions, accounts, categories, debts, removeTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [tab, setTab] = useState<Tab>('transactions');
    const [accountId, setAccountId] = useState<string | null>(null);

    const ledger = useMemo(() => computeLedger(transactions, accounts, categories, accountId), [transactions, accounts, categories, accountId]);
    const trialBalance = useMemo(() => computeTrialBalance(accounts, debts, categories, transactions), [accounts, debts, categories, transactions]);
    const isBalanced = Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) < 0.01;

    const handleRowPress = (entry: LedgerEntry) => {
        Alert.alert(entry.transaction.description || entry.categoryName, undefined, [
            { text: 'Edit', onPress: () => navigation.navigate('AddTransaction', { transactionId: entry.transaction.id }) },
            { text: 'Delete', style: 'destructive', onPress: () => removeTransaction(entry.transaction.id) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleExport = async () => {
        try {
            if (tab === 'trialBalance') {
                const rows = trialBalance.rows.map((r) => ({
                    Account: r.name, Type: TYPE_LABEL[r.type],
                    Debit: r.debit ? r.debit.toFixed(2) : '', Credit: r.credit ? r.credit.toFixed(2) : '',
                }));
                await exportCsv('trial-balance.csv', rows);
                return;
            }
            const rows = ledger.entries.map((e) => ({
                Date: e.transaction.date,
                Time: e.transaction.time || '',
                Description: e.transaction.description,
                Category: e.categoryName,
                Account: e.accountName,
                Debit: e.debit ? e.debit.toFixed(2) : '',
                Credit: e.credit ? e.credit.toFixed(2) : '',
                Balance: e.runningBalance !== null ? e.runningBalance.toFixed(2) : '',
            }));
            await exportCsv(`ledger-${accountId ? accounts.find((a) => a.id === accountId)?.name.replace(/\s+/g, '_') : 'all-accounts'}.csv`, rows);
        } catch (e: any) {
            Alert.alert('Export failed', e?.message || 'Could not export.');
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScreenHeader
                title="General Ledger"
                right={
                    <Pressable style={styles.exportBtn} onPress={handleExport}>
                        <Ionicons name="download-outline" size={20} color={Colors.text} />
                    </Pressable>
                }
            />

            <View style={styles.tabRow}>
                <Pressable onPress={() => setTab('transactions')} style={[styles.tabChip, tab === 'transactions' && styles.tabChipActive]}>
                    <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>Transactions</Text>
                </Pressable>
                <Pressable onPress={() => setTab('trialBalance')} style={[styles.tabChip, tab === 'trialBalance' && styles.tabChipActive]}>
                    <Text style={[styles.tabText, tab === 'trialBalance' && styles.tabTextActive]}>Trial Balance</Text>
                </Pressable>
            </View>

            {tab === 'transactions' ? (
                <>
                    <View style={styles.filterRow}>
                        <Pressable onPress={() => setAccountId(null)} style={[styles.filterChip, accountId === null && styles.filterChipActive]}>
                            <Text style={[styles.filterText, accountId === null && styles.filterTextActive]}>All accounts</Text>
                        </Pressable>
                        {accounts.map((a) => (
                            <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[styles.filterChip, accountId === a.id && styles.filterChipActive]}>
                                <Text style={[styles.filterText, accountId === a.id && styles.filterTextActive]}>{a.name}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Card style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <View><Text style={styles.summaryLabel}>Credits</Text><Text style={[styles.summaryValue, { color: Colors.income }]}>{formatMoney(ledger.totalCredits, symbol)}</Text></View>
                            <View><Text style={styles.summaryLabel}>Debits</Text><Text style={[styles.summaryValue, { color: Colors.expense }]}>{formatMoney(ledger.totalDebits, symbol)}</Text></View>
                            <View><Text style={styles.summaryLabel}>Net</Text><Text style={styles.summaryValue}>{ledger.net >= 0 ? '+' : ''}{formatMoney(ledger.net, symbol)}</Text></View>
                        </View>
                    </Card>

                    <FlatList
                        data={ledger.entries}
                        keyExtractor={(e) => e.transaction.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<EmptyState icon="book-outline" title="Nothing recorded yet" message="Every transaction you log shows up here, in date order, with a running balance." />}
                        renderItem={({ item }) => <LedgerRow entry={item} symbol={symbol} onPress={() => handleRowPress(item)} />}
                        ItemSeparatorComponent={() => <View style={styles.sep} />}
                    />
                </>
            ) : (
                <FlatList
                    data={trialBalance.rows}
                    keyExtractor={(r, i) => `${r.type}-${r.name}-${i}`}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <>
                            <Card style={[styles.balanceCard, { borderColor: isBalanced ? Colors.good : Colors.warning }]}>
                                <View style={styles.balanceRow}>
                                    <Ionicons name={isBalanced ? 'checkmark-circle' : 'alert-circle'} size={18} color={isBalanced ? Colors.good : Colors.warning} />
                                    <Text style={[styles.balanceLabel, { color: isBalanced ? Colors.good : Colors.warning }]}>{isBalanced ? 'Balanced' : 'Out of balance'}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <View><Text style={styles.summaryLabel}>Total Debits</Text><Text style={styles.summaryValue}>{formatMoney(trialBalance.totalDebits, symbol)}</Text></View>
                                    <View><Text style={styles.summaryLabel}>Total Credits</Text><Text style={styles.summaryValue}>{formatMoney(trialBalance.totalCredits, symbol)}</Text></View>
                                </View>
                            </Card>
                            <Text style={styles.tbHint}>
                                Assets and liabilities show current balances; income and expenses show all-time totals by category. "Opening Balance Equity" is the balancing figure for money already in your accounts before it was tracked here.
                            </Text>
                        </>
                    }
                    ListEmptyComponent={<EmptyState icon="calculator-outline" title="Nothing to balance yet" message="Add an account, debt, or a few transactions to see a trial balance." />}
                    renderItem={({ item, index }) => {
                        const prevType = index > 0 ? trialBalance.rows[index - 1].type : null;
                        return (
                            <>
                                {item.type !== prevType && <Text style={styles.tbGroupLabel}>{TYPE_LABEL[item.type]}</Text>}
                                <View style={styles.tbRow}>
                                    <Text style={styles.tbName}>{item.name}</Text>
                                    <Text style={styles.tbAmount}>{item.debit > 0 ? formatMoney(item.debit, symbol) : ''}</Text>
                                    <Text style={styles.tbAmount}>{item.credit > 0 ? formatMoney(item.credit, symbol) : ''}</Text>
                                </View>
                            </>
                        );
                    }}
                    ListFooterComponent={trialBalance.rows.length > 0 ? (
                        <View style={styles.tbTotalRow}>
                            <Text style={styles.tbTotalName}>Total</Text>
                            <Text style={styles.tbTotalAmount}>{formatMoney(trialBalance.totalDebits, symbol)}</Text>
                            <Text style={styles.tbTotalAmount}>{formatMoney(trialBalance.totalCredits, symbol)}</Text>
                        </View>
                    ) : null}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    exportBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
    tabRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    tabChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    tabChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    filterChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    filterText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    filterTextActive: { color: Colors.primary },
    summaryCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { color: Colors.textFaint, fontSize: 11 },
    summaryValue: { color: Colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Spacing.sm, gap: Spacing.sm },
    rowMain: { flex: 1, gap: 2 },
    rowDesc: { color: Colors.text, fontSize: 14, fontWeight: '600' },
    rowMeta: { color: Colors.textFaint, fontSize: 11 },
    rowAmounts: { alignItems: 'flex-end', gap: 2 },
    rowAmount: { fontSize: 14, fontWeight: '700' },
    rowBalance: { color: Colors.textFaint, fontSize: 11 },
    sep: { height: 1, backgroundColor: Colors.border },
    balanceCard: { gap: Spacing.sm, borderWidth: 1, marginBottom: Spacing.sm },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    balanceLabel: { fontSize: 14, fontWeight: '800' },
    tbHint: { color: Colors.textFaint, fontSize: 11, lineHeight: 16, marginBottom: Spacing.sm },
    tbGroupLabel: { color: Colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: 4 },
    tbRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
    tbName: { color: Colors.text, fontSize: 13, flex: 2 },
    tbAmount: { color: Colors.textMuted, fontSize: 13, flex: 1, textAlign: 'right' },
    tbTotalRow: { flexDirection: 'row', paddingTop: Spacing.sm, marginTop: 4, borderTopWidth: 2, borderTopColor: Colors.border },
    tbTotalName: { color: Colors.text, fontSize: 13, fontWeight: '800', flex: 2 },
    tbTotalAmount: { color: Colors.text, fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right' },
});
