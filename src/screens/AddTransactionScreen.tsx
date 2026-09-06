import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import ScreenHeader from '../components/ScreenHeader';
import { Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { RootStackParamList } from '../navigation/types';
import { CategoryType, Ownership, RecurringFrequency } from '../types';
import { todayISO } from '../utils/date';
import { uploadReceiptImage } from '../utils/receiptStorage';

export default function AddTransactionScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'AddTransaction'>>();
    const { household, categories, members, incomeSources, accounts, addTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const [type, setType] = useState<CategoryType>(route.params?.type || 'expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [memberId, setMemberId] = useState<string | null>(members[0]?.id ?? null);
    const [incomeSourceId, setIncomeSourceId] = useState<string | null>(null);
    const [ownership, setOwnership] = useState<Ownership>('shared');
    const [isRecurring, setIsRecurring] = useState(false);
    const [receiptUri, setReceiptUri] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const relevantCategories = categories.filter((c) => c.type === type);
    const numericAmount = parseFloat(amount.replace(/,/g, ''));
    const canSave = !Number.isNaN(numericAmount) && numericAmount > 0 && !!categoryId;

    const handlePickReceipt = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission needed', 'Allow photo access to attach a receipt.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
        if (!result.canceled && result.assets?.[0]?.uri) setReceiptUri(result.assets[0].uri);
    };

    const handleSave = async () => {
        if (!canSave || !categoryId || !household) return;
        setSaving(true);
        let receiptUrl: string | undefined;
        if (receiptUri) {
            try {
                receiptUrl = await uploadReceiptImage(household.id, receiptUri);
            } catch (e: any) {
                Alert.alert('Receipt upload failed', e?.message || 'Saving the transaction without it.');
            }
        }
        addTransaction({
            date: todayISO(),
            type,
            amount: numericAmount,
            categoryId,
            memberId: memberId || undefined,
            incomeSourceId: type === 'income' ? incomeSourceId || undefined : undefined,
            accountId: accounts[0]?.id,
            ownership,
            description: description.trim(),
            isRecurring,
            recurringFrequency: isRecurring ? 'monthly' as RecurringFrequency : undefined,
            receiptUrl,
        });
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title={type === 'income' ? 'Add Income' : 'Add Expense'} />
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
                    ) : (
                        <Pressable style={styles.receiptPickBtn} onPress={handlePickReceipt}>
                            <Ionicons name="camera-outline" size={18} color={Colors.textMuted} />
                            <Text style={styles.receiptPickText}>Attach a photo</Text>
                        </Pressable>
                    )}
                </View>

                <Button label="Save transaction" onPress={handleSave} disabled={!canSave} loading={saving} />
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
});
