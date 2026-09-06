import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import ScreenHeader from '../components/ScreenHeader';
import { Card, Button, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { parseStatementCsv, ParsedStatementRow } from '../utils/statementParser';
import { readPickedFileAsText } from '../utils/readTextFile';
import { formatMoney } from '../utils/currency';
import { shortDate } from '../utils/date';

export default function ImportStatementScreen() {
    const navigation = useNavigation();
    const { household, categories, bulkAddTransactions } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const [rows, setRows] = useState<ParsedStatementRow[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    const handlePickFile = async () => {
        setError(null);
        const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'] });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        try {
            const text = await readPickedFileAsText({ uri: asset.uri, file: (asset as any).file });
            const parsed = parseStatementCsv(text, categories);
            if (parsed.error) { setError(parsed.error); setRows([]); return; }
            setRows(parsed.rows);
            setFileName(asset.name);
        } catch (e: any) {
            setError(e?.message || 'Could not read that file.');
        }
    };

    const toggleRow = (clientId: string) => {
        setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, include: !r.include } : r)));
    };

    const includedCount = rows.filter((r) => r.include).length;

    const handleImport = async () => {
        const toImport = rows.filter((r) => r.include);
        if (toImport.length === 0) return;
        setImporting(true);
        const result = await bulkAddTransactions(toImport.map((r) => ({
            date: r.date,
            type: r.type,
            amount: r.amount,
            categoryId: r.categoryId || categories.find((c) => c.type === r.type)?.id || '',
            ownership: 'shared',
            description: r.description,
            isRecurring: false,
        })));
        setImporting(false);
        if (result.error) {
            Alert.alert('Import failed', result.error);
            return;
        }
        Alert.alert('Imported', `Added ${result.count} transaction${result.count === 1 ? '' : 's'}.`, [
            { text: 'OK', onPress: () => navigation.goBack() },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Import Bank Statement" subtitle="CSV files from your bank" />
            <View style={styles.container}>
                <Card style={styles.pickCard}>
                    <Pressable style={styles.pickBtn} onPress={handlePickFile}>
                        <Ionicons name="document-attach-outline" size={20} color={Colors.primary} />
                        <Text style={styles.pickBtnText}>{fileName || 'Choose a CSV file'}</Text>
                    </Pressable>
                    {error ? <Text style={styles.errorText}>{error}</Text> : (
                        <Text style={styles.hint}>Expected columns like Date, Description, and Amount (or Debit/Credit).</Text>
                    )}
                </Card>

                {rows.length > 0 && (
                    <>
                        <Text style={styles.summaryText}>{includedCount} of {rows.length} rows selected — tap a row to include/exclude it.</Text>
                        <FlatList
                            data={rows}
                            keyExtractor={(r) => r.clientId}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <Pressable style={[styles.row, !item.include && styles.rowExcluded]} onPress={() => toggleRow(item.clientId)}>
                                    <Ionicons name={item.include ? 'checkbox' : 'square-outline'} size={20} color={item.include ? Colors.primary : Colors.textFaint} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowDesc} numberOfLines={1}>{item.description}</Text>
                                        <Text style={styles.rowMeta}>{shortDate(item.date)} · {item.categoryLabel}</Text>
                                    </View>
                                    <Text style={[styles.rowAmount, { color: item.type === 'income' ? Colors.income : Colors.text }]}>
                                        {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount, symbol)}
                                    </Text>
                                </Pressable>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.sep} />}
                        />
                        <Button label={`Import ${includedCount} transaction${includedCount === 1 ? '' : 's'}`} onPress={handleImport} disabled={includedCount === 0} loading={importing} />
                    </>
                )}

                {rows.length === 0 && !error && (
                    <EmptyState icon="cloud-upload-outline" title="No file loaded" message="Export a CSV statement from your bank's app or website, then choose it above." />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
    pickCard: { gap: Spacing.sm },
    pickBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: Colors.primaryMuted },
    pickBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    errorText: { color: Colors.warning, fontSize: 12 },
    hint: { color: Colors.textFaint, fontSize: 11 },
    summaryText: { color: Colors.textMuted, fontSize: 12 },
    listContent: { paddingBottom: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    rowExcluded: { opacity: 0.4 },
    rowDesc: { color: Colors.text, fontSize: 13, fontWeight: '600' },
    rowMeta: { color: Colors.textFaint, fontSize: 11 },
    rowAmount: { fontSize: 13, fontWeight: '700' },
    sep: { height: 1, backgroundColor: Colors.border },
});
