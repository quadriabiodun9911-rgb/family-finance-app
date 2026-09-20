import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import ScreenHeader from '../components/ScreenHeader';
import { Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useActionSheet } from '../context/ActionSheetContext';
import { RootStackParamList } from '../navigation/types';
import { CategoryType, Ownership, RecurringFrequency } from '../types';
import { todayISO, nowTimeHHMM } from '../utils/date';
import { uploadReceiptImage, getReceiptSignedUrl } from '../utils/receiptStorage';

export default function AddTransactionScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'AddTransaction'>>();
    const { household, categories, members, incomeSources, accounts, transactions, addTransaction, updateTransaction } = useFinance();
    const { notice } = useActionSheet();
    const symbol = household?.currencySymbol || '$';

    const editingId = route.params?.transactionId;
    const existing = editingId ? transactions.find((t) => t.id === editingId) : undefined;
    const isEditing = !!existing;

    const [type, setType] = useState<CategoryType>(existing?.type || route.params?.type || 'expense');
    const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
    const [description, setDescription] = useState(existing?.description || '');
    const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
    const [memberId, setMemberId] = useState<string | null>(existing?.memberId ?? members[0]?.id ?? null);
    const [incomeSourceId, setIncomeSourceId] = useState<string | null>(existing?.incomeSourceId ?? null);
    const [ownership, setOwnership] = useState<Ownership>(existing?.ownership || 'shared');
    const [isRecurring, setIsRecurring] = useState(existing?.isRecurring || false);
    const [receiptUri, setReceiptUri] = useState<string | null>(null);
    const [existingReceiptSignedUrl, setExistingReceiptSignedUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [time, setTime] = useState(existing?.time || nowTimeHHMM());

    useEffect(() => {
        if (existing?.receiptUrl) {
            getReceiptSignedUrl(existing.receiptUrl).then(setExistingReceiptSignedUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existing?.receiptUrl]);

    const relevantCategories = categories.filter((c) => c.type === type);
    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    const timeValid = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
    const canSave = !Number.isNaN(numericAmount) && numericAmount > 0 && !!categoryId && timeValid;

    const handlePickReceipt = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            notice({ title: 'Permission needed', message: 'Allow photo access to attach a receipt.' });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
        if (!result.canceled && result.assets?.[0]?.uri) setReceiptUri(result.assets[0].uri);
    };

    const handleSave = async () => {
        if (!canSave || !categoryId || !household) return;
        setSaving(true);
        let receiptUrl: string | undefined = existing?.receiptUrl;
        if (receiptUri) {
            try {
                receiptUrl = await uploadReceiptImage(household.id, receiptUri);
            } catch (e: any) {
                notice({ title: 'Receipt upload failed', message: e?.message || 'Saving the transaction without it.' });
            }
        }
        const fields = {
            date: existing?.date || todayISO(),
            type,
            amount: numericAmount,
            categoryId,
            memberId: memberId || undefined,
            incomeSourceId: type === 'income' ? incomeSourceId || undefined : undefined,
            accountId: existing?.accountId || accounts[0]?.id,
            ownership,
            description: description.trim(),
            isRecurring,
            recurringFrequency: isRecurring ? 'monthly' as RecurringFrequency : undefined,
            receiptUrl,
            time: time.trim(),
        };
        if (isEditing && existing) {
            updateTransaction(existing.id, fields);
        } else {
            addTransaction(fields);
        }
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title={isEditing ? (type === 'income' ? 'Edit Income' : 'Edit Expense') : (type === 'income' ? 'Add Income' : 'Add Expense')} />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.typeToggle}>
                    <Pressable style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpenseActive]} onPress={() => { setType('expense'); setCategoryId(null); }}>
                        <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
                    </Pressable>
                    <Pressable style={[styles.typeBtn, type === 'income' && styles.typeBtnIncomeActive]} onPress={() => { setType('income'); setCategoryId(null); }}>
                        <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>Income</Text>
                    </Pressable>
                </View>

                <FormField label={`Amount (${symbol})`} placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
                <FormField label="Description" placeholder="e.g. Weekly groceries" value={description} onChangeText={setDescription} />

                <View style={styles.timeRow}>
                    <View style={styles.timeFieldWrap}>
                        <FormField
                            label="Time"
                            placeholder="HH:MM"
                            value={time}
                            onChangeText={setTime}
                            style={!timeValid && time.length > 0 ? styles.timeInputError : undefined}
                        />
                    </View>
                    <Pressable style={styles.nowBtn} onPress={() => setTime(nowTimeHHMM())}>
                        <Text style={styles.nowBtnText}>Now</Text>
                    </Pressable>
                </View>
                {!timeValid && time.length > 0 && <Text style={styles.errorText}>Use 24-hour HH:MM, e.g. 14:30.</Text>}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Category</Text>
                    <View style={styles.chipWrap}>
                        {relevantCategories.map((c) => (
                            <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && { backgroundColor: c.color + '33', borderColor: c.color }]}>
                                <Ionicons name={c.icon as any} size={14} color={categoryId === c.id ? c.color : Colors.textMuted} />
                                <Text style={[styles.chipText, categoryId === c.id && { color: c.color }]}>{c.name}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {members.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Who</Text>
                        <View style={styles.chipWrap}>
                            {members.map((m) => (
                                <Pressable key={m.id} onPress={() => setMemberId(m.id)} style={[styles.chip, memberId === m.id && { backgroundColor: m.color + '33', borderColor: m.color }]}>
                                    <Text style={[styles.chipText, memberId === m.id && { color: m.color }]}>{m.name}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {type === 'income' && incomeSources.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Income source</Text>
                        <View style={styles.chipWrap}>
                            {incomeSources.map((s) => (
                                <Pressable key={s.id} onPress={() => setIncomeSourceId(s.id === incomeSourceId ? null : s.id)} style={[styles.chip, incomeSourceId === s.id && styles.chipActive]}>
                                    <Text style={[styles.chipText, incomeSourceId === s.id && styles.chipTextActive]}>{s.name}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Ownership</Text>
                    <View style={styles.chipWrap}>
                        {(['shared', 'individual'] as Ownership[]).map((o) => (
                            <Pressable key={o} onPress={() => setOwnership(o)} style={[styles.chip, ownership === o && styles.chipActive]}>
                                <Text style={[styles.chipText, ownership === o && styles.chipTextActive]}>{o === 'shared' ? 'Household (shared)' : 'Personal'}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.recurringRow}>
                    <Text style={styles.sectionLabel}>Recurring monthly</Text>
                    <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: Colors.primary }} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Receipt (optional)</Text>
                    {receiptUri ? (
                        <View style={styles.receiptPreviewRow}>
                            <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
                            <Pressable onPress={() => setReceiptUri(null)} style={styles.receiptRemoveBtn}>
                                <Ionicons name="close" size={16} color={Colors.textMuted} />
                            </Pressable>
                        </View>
                    ) : existingReceiptSignedUrl ? (
                        <View style={styles.receiptPreviewRow}>
                            <Image source={{ uri: existingReceiptSignedUrl }} style={styles.receiptThumb} />
                            <Pressable onPress={handlePickReceipt} style={styles.receiptRemoveBtn}>
                                <Ionicons name="camera-outline" size={16} color={Colors.textMuted} />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable style={styles.receiptPickBtn} onPress={handlePickReceipt}>
                            <Ionicons name="camera-outline" size={18} color={Colors.textMuted} />
                            <Text style={styles.receiptPickText}>Attach a photo</Text>
                        </Pressable>
                    )}
                </View>

                <Button label={isEditing ? 'Save changes' : 'Save transaction'} onPress={handleSave} disabled={!canSave} loading={saving} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    typeToggle: { flexDirection: 'row', gap: Spacing.sm },
    typeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surfaceAlt },
    typeBtnExpenseActive: { backgroundColor: Colors.warningMuted, borderColor: Colors.warning },
    typeBtnIncomeActive: { backgroundColor: Colors.goodMuted, borderColor: Colors.good },
    typeBtnText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
    typeBtnTextActive: { color: Colors.text },
    section: { gap: Spacing.sm },
    sectionLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    chipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: Colors.primary },
    recurringRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    receiptPickBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', backgroundColor: Colors.surfaceAlt },
    receiptPickText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    receiptPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    receiptThumb: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
    receiptRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    timeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
    timeFieldWrap: { flex: 1 },
    timeInputError: { borderColor: Colors.warning },
    nowBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    nowBtnText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
    errorText: { color: Colors.warning, fontSize: 12, marginTop: -Spacing.sm },
});
