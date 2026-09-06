import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TransactionRow from '../components/TransactionRow';
import { EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { RootStackParamList } from '../navigation/types';
import { CategoryType } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | CategoryType;

export default function TransactionsScreen() {
    const navigation = useNavigation<Nav>();
    const { household, transactions, categories, removeTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [filter, setFilter] = useState<Filter>('all');

    const filtered = useMemo(() => {
        const list = filter === 'all' ? transactions : transactions.filter((t) => t.type === filter);
        return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [transactions, filter]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Transactions</Text>
                <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddTransaction')}>
                    <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
            </View>
            <View style={styles.filterRow}>
                {(['all', 'income', 'expense'] as Filter[]).map((f) => (
                    <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}</Text>
                    </Pressable>
                ))}
            </View>
            <FlatList
                data={filtered}
                keyExtractor={(t) => t.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<EmptyState icon="receipt-outline" title="No transactions yet" message="Add your first income or expense to start building your household's picture." />}
                renderItem={({ item }) => (
                    <TransactionRow
                        transaction={item}
                        category={categories.find((c) => c.id === item.categoryId)}
                        symbol={symbol}
                        onPress={() => Alert.alert(
                            'Delete transaction',
                            `Remove "${item.description || 'this transaction'}"?`,
                            [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => removeTransaction(item.id) }],
                        )}
                    />
                )}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
    addBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    filterRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    filterChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    filterText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    filterTextActive: { color: Colors.primary },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    sep: { height: 1, backgroundColor: Colors.border },
});
