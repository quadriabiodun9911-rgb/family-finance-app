import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import ScreenHeader from '../components/ScreenHeader';
import { Card, Button, EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useActionSheet } from '../context/ActionSheetContext';
import { parseStatementCsv, scannedTransactionsToRows, ParsedStatementRow } from '../utils/statementParser';
import { readPickedFileAsText } from '../utils/readTextFile';
import { readPickedFileAsBase64 } from '../utils/readFileAsBase64';
import { scanStatementImage, ScanMediaType } from '../utils/statementScan';
import { formatMoney } from '../utils/currency';
import { shortDate } from '../utils/date';

export default function ImportStatementScreen() {
    const navigation = useNavigation();
    const { household, categories, accounts, bulkAddTransactions } = useFinance();
    const { notice } = useActionSheet();
    const symbol = household?.currencySymbol || '$';

    const [rows, setRows] = useState<ParsedStatementRow[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanWarning, setScanWarning] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);

    // Shared by the camera, photo library, and scanned-PDF paths below --
    // sends the image/PDF to the statement-scan Edge Function (Claude
    // vision) and turns whatever it reads into the same review-before-
    // import row list the CSV path produces.
    const runScan = async (base64: string, mediaType: ScanMediaType, sourceName: string) => {
        setError(null);
        setScanWarning(null);
        setScanning(true);
        try {
            const result = await scanStatementImage(base64, mediaType);
            if (result.transactions.length === 0) {
                setRows([]);
                setError(result.warning || "Couldn't find any transactions in that document — try a clearer photo or a different page.");
                return;
            }
            setRows(scannedTransactionsToRows(result.transactions, categories));
            setFileName(sourceName);
            setScanWarning(result.warning ?? null);
        } catch (e: any) {
            setError(e?.message || 'Could not scan that document.');
        } finally {
            setScanning(false);
        }
    };

    const handleTakePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Camera access is needed to photograph a statement or receipt.'); return; }
        const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
        if (result.canceled || !result.assets?.[0]?.base64) return;
        const asset = result.assets[0];
        const mediaType = (asset.mimeType as ScanMediaType) || 'image/jpeg';
        await runScan(asset.base64!, mediaType, 'Photo');
    };

    const handleChoosePhoto = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setError('Photo library access is needed to choose an image.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
        if (result.canceled || !result.assets?.[0]?.base64) return;
        const asset = result.assets[0];
        const mediaType = (asset.mimeType as ScanMediaType) || 'image/jpeg';
        await runScan(asset.base64!, mediaType, 'Photo');
    };

    const handlePickFile = async () => {
        setError(null);
        setScanWarning(null);
        const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/pdf', '*/*'] });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            try {
                const base64 = await readPickedFileAsBase64({ uri: asset.uri, file: (asset as any).file });
                await runScan(base64, 'application/pdf', asset.name);
            } catch (e: any) {
                setError(e?.message || 'Could not read that PDF.');
            }
            return;
        }
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
            accountId: accountId || undefined,
            ownership: 'shared',
            description: r.description,
            isRecurring: false,
        })));
        setImporting(false);
        if (result.error) {
            notice({ title: 'Import failed', message: result.error });
            return;
        }
        notice({ title: 'Imported', message: `Added ${result.count} transaction${result.count === 1 ? '' : 's'}.`, onDismiss: () => navigation.goBack() });
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Import Bank Statement" subtitle="CSV, PDF, or a photo of a statement or receipt" />
            <View style={styles.container}>
                <Card style={styles.pickCard}>
                    {scanning ? (
                        <View style={styles.scanningRow}>
                            <ActivityIndicator color={Colors.primary} />
                            <Text style={styles.scanningText}>Reading your document…</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.scanBtnRow}>
                                <Pressable style={styles.scanBtn} onPress={handleTakePhoto}>
                                    <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.scanBtnText}>Take Photo</Text>
                                </Pressable>
                                <Pressable style={styles.scanBtn} onPress={handleChoosePhoto}>
                                    <Ionicons name="image-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.scanBtnText}>Choose Photo</Text>
                                </Pressable>
                            </View>
                            <Pressable style={styles.pickBtn} onPress={handlePickFile}>
                                <Ionicons name="document-attach-outline" size={20} color={Colors.primary} />
                                <Text style={styles.pickBtnText}>{fileName || 'Choose a CSV or PDF file'}</Text>
                            </Pressable>
                        </>
                    )}
                    {error ? <Text style={styles.errorText}>{error}</Text> : !scanning && (
                        <Text style={styles.hint}>Photograph a receipt or statement, upload a scanned PDF, or choose a CSV export with columns like Date, Description, and Amount (or Debit/Credit).</Text>
                    )}
                </Card>

                {scanWarning && rows.length > 0 && (
                    <View style={styles.warningBanner}>
                        <Ionicons name="alert-circle-outline" size={16} color={Colors.watch} />
                        <Text style={styles.warningBannerText}>{scanWarning}</Text>
                    </View>
                )}

                {rows.length > 0 && (
                    <>
                        {accounts.length > 0 ? (
                            <View style={styles.accountPickWrap}>
                                <Text style={styles.summaryText}>Import into</Text>
                                <View style={styles.accountChipRow}>
                                    {accounts.map((a) => (
                                        <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[styles.accountChip, accountId === a.id && styles.accountChipActive]}>
                                            <Text style={[styles.accountChipText, accountId === a.id && styles.accountChipTextActive]}>{a.name}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.hint}>No accounts set up yet — these will import without one. Add an account from Savings & Investments so the Ledger can track a running balance.</Text>
                        )}
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

                {rows.length === 0 && !error && !scanning && (
                    <EmptyState icon="cloud-upload-outline" title="Nothing loaded yet" message="Take a photo of a receipt or statement, upload a scanned PDF, or export a CSV from your bank's app or website." />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
    pickCard: { gap: Spacing.sm },
    scanBtnRow: { flexDirection: 'row', gap: Spacing.sm },
    scanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
    scanBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
    scanningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
    scanningText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    pickBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', backgroundColor: Colors.surfaceAlt },
    pickBtnText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    errorText: { color: Colors.warning, fontSize: 12 },
    hint: { color: Colors.textFaint, fontSize: 11 },
    warningBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.watch + '18', borderWidth: 1, borderColor: Colors.watch, borderRadius: Radius.md, padding: Spacing.sm },
    warningBannerText: { flex: 1, color: Colors.watch, fontSize: 12, lineHeight: 17 },
    summaryText: { color: Colors.textMuted, fontSize: 12 },
    accountPickWrap: { gap: Spacing.xs },
    accountChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    accountChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    accountChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    accountChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    accountChipTextActive: { color: Colors.primary },
    listContent: { paddingBottom: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    rowExcluded: { opacity: 0.4 },
    rowDesc: { color: Colors.text, fontSize: 13, fontWeight: '600' },
    rowMeta: { color: Colors.textFaint, fontSize: 11 },
    rowAmount: { fontSize: 13, fontWeight: '700' },
    sep: { height: 1, backgroundColor: Colors.border },
});
