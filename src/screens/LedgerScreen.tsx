import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeLedger, LedgerEntry } from '../intelligence/ledger';
import { exportCsv } from '../utils/csvExport';
import { formatMoney } from '../utils/currency';
import { shortDate, formatTimeLabel } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
    const { household, transactions, accounts, categories, removeTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [accountId, setAccountId] = useState<string | null>(null);

    const ledger = useMemo(() => computeLedger(transactions, accounts, categories, accountId), [transactions, accounts, categories, accountId]);

    const handleRowPress = (entry: LedgerEntry) => {
        Alert.alert(entry.transaction.description || entry.categoryName, undefined, [
            { text: 'Edit', onPress: () => navigation.navigate('AddTransaction', { transactionId: entry.transaction.id }) },
            { text: 'Delete', style: 'destructive', onPress: () => removeTransaction(entry.transaction.id) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleExport = async () => {
        try {
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
            Alert.alert('Export failed', e?.message || 'Could not export the ledger.');
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>General Ledger</Text>
                <Pressable style={styles.exportBtn} onPress={handleExport}>
                    <Ionicons name="download-outline" size={20} color={Colors.text} />
                </Pressable>
            </View>

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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
    exportBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
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
});
