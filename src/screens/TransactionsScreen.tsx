import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import TransactionRow from '../components/TransactionRow';
import { EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { RootStackParamList } from '../navigation/types';
import { CategoryType, Transaction } from '../types';
import { getReceiptSignedUrl } from '../utils/receiptStorage';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | CategoryType;

export default function TransactionsScreen() {
    const navigation = useNavigation<Nav>();
    const { household, transactions, categories, removeTransaction, uploadReceiptForTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [filter, setFilter] = useState<Filter>('all');

    const handleAttachReceipt = async (transactionId: string) => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission needed', 'Allow photo access to attach a receipt.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const { error } = await uploadReceiptForTransaction(transactionId, result.assets[0].uri);
        if (error) Alert.alert('Upload failed', error);
    };

    const handleViewReceipt = async (path: string) => {
        const url = await getReceiptSignedUrl(path);
        if (!url) { Alert.alert('Could not open receipt', 'Try again in a moment.'); return; }
        Linking.openURL(url);
    };

    const handleRowPress = (item: Transaction) => {
        const options: any[] = [];
        if (item.receiptUrl) options.push({ text: 'View receipt', onPress: () => handleViewReceipt(item.receiptUrl!) });
        else options.push({ text: 'Attach receipt', onPress: () => handleAttachReceipt(item.id) });
        options.push({ text: 'Delete', style: 'destructive', onPress: () => removeTransaction(item.id) });
        options.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert(item.description || 'Transaction', undefined, options);
    };

    const filtered = useMemo(() => {
        const list = filter === 'all' ? transactions : transactions.filter((t) => t.type === filter);
        return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [transactions, filter]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Transactions</Text>
                <View style={styles.headerActions}>
                    <Pressable style={styles.importBtn} onPress={() => navigation.navigate('ImportStatement')}>
                        <Ionicons name="cloud-upload-outline" size={20} color={Colors.text} />
                    </Pressable>
                    <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddTransaction')}>
                        <Ionicons name="add" size={22} color="#fff" />
                    </Pressable>
                </View>
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
                        onPress={() => handleRowPress(item)}
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
    headerActions: { flexDirection: 'row', gap: Spacing.sm },
    importBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
    addBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    filterRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    filterChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    filterText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    filterTextActive: { color: Colors.primary },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    sep: { height: 1, backgroundColor: Colors.border },
});
