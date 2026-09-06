import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Category, Transaction } from '../types';
import { formatMoney } from '../utils/currency';
import { shortDate } from '../utils/date';

export default function TransactionRow({ transaction, category, symbol, onPress }: {
    transaction: Transaction; category: Category | undefined; symbol: string; onPress?: () => void;
}) {
    const isIncome = transaction.type === 'income';
    return (
        <Pressable style={styles.row} onPress={onPress}>
            <View style={[styles.iconWrap, { backgroundColor: (category?.color || Colors.primary) + '26' }]}>
                <Ionicons name={(category?.icon as any) || 'ellipse'} size={18} color={category?.color || Colors.primary} />
            </View>
            <View style={styles.middle}>
                <Text style={styles.desc} numberOfLines={1}>{transaction.description || category?.name || 'Transaction'}</Text>
                <Text style={styles.meta}>{category?.name || 'Uncategorized'} · {shortDate(transaction.date)}</Text>
            </View>
            <Text style={[styles.amount, { color: isIncome ? Colors.income : Colors.text }]}>
                {isIncome ? '+' : '-'}{formatMoney(transaction.amount, symbol)}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
    iconWrap: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    middle: { flex: 1, gap: 2 },
    desc: { color: Colors.text, fontSize: 14, fontWeight: '600' },
    meta: { color: Colors.textFaint, fontSize: 12 },
    amount: { fontSize: 14, fontWeight: '700' },
});
