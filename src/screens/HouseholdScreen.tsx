import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import QuickAddRow from '../components/QuickAddRow';
import { Card } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { MemberPermission, MemberRole } from '../types';

const ROLE_OPTIONS: { role: MemberRole; permission: MemberPermission; label: string }[] = [
    { role: 'owner', permission: 'full', label: 'Owner (full view)' },
    { role: 'partner', permission: 'shared', label: 'Partner (shared)' },
    { role: 'teen', permission: 'own', label: 'Teen (own only)' },
    { role: 'child', permission: 'own', label: 'Child (own only)' },
];

export default function HouseholdScreen() {
    const { household, members, addMember, removeMember, categories, addCategory, removeCategory, recurringBills, addRecurringBill, removeRecurringBill } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [newRole, setNewRole] = useState(ROLE_OPTIONS[1]);

    const confirmRemove = (label: string, fn: () => void) => Alert.alert('Remove', `Remove ${label}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: fn }]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Household" subtitle={household?.name} />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Family members</Text>
                    {members.map((m) => (
                        <Pressable key={m.id} style={styles.memberRow} onLongPress={() => m.role !== 'owner' && confirmRemove(m.name, () => removeMember(m.id))}>
                            <View style={[styles.avatar, { backgroundColor: m.color }]}><Text style={styles.avatarText}>{m.name[0]?.toUpperCase()}</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.memberName}>{m.name}</Text>
                                <Text style={styles.memberRole}>{m.role} · {m.permission === 'full' ? 'sees everything' : m.permission === 'shared' ? 'shared + own' : 'own only'}</Text>
                            </View>
                        </Pressable>
                    ))}
                    <View style={styles.roleChipRow}>
                        {ROLE_OPTIONS.map((opt) => (
                            <Pressable key={opt.label} onPress={() => setNewRole(opt)} style={[styles.roleChip, newRole.label === opt.label && styles.roleChipActive]}>
                                <Text style={[styles.roleChipText, newRole.label === opt.label && styles.roleChipTextActive]}>{opt.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <QuickAddRow
                        namePlaceholder="Member name"
                        amountPlaceholder=""
                        showAmount={false}
                        onAdd={(name) => addMember({ name, role: newRole.role, permission: newRole.permission, color: '#a855f7' })}
                    />
                    <Text style={styles.hint}>Long-press a member to remove them.</Text>
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Recurring bills</Text>
                    {recurringBills.map((b) => (
                        <Pressable key={b.id} style={styles.billRow} onLongPress={() => confirmRemove(b.name, () => removeRecurringBill(b.id))}>
                            <Ionicons name="calendar" size={14} color={Colors.textMuted} />
                            <Text style={styles.billName}>{b.name}</Text>
                            <Text style={styles.billMeta}>{symbol}{b.amount} · day {b.dueDay}</Text>
                        </Pressable>
                    ))}
                    <QuickAddRow
                        namePlaceholder="e.g. Mortgage (due day 1-28)"
                        amountPlaceholder="Amount"
                        onAdd={(name, amount) => addRecurringBill({ name, amount, dueDay: 1, categoryId: categories.find((c) => c.name === 'Housing')?.id || categories[0]?.id, active: true })}
                    />
                    <Text style={styles.hint}>New bills default to due day 1 — long-press to remove and re-add with a different day.</Text>
                </Card>

                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Categories</Text>
                    {categories.filter((c) => c.type === 'expense').map((c) => (
                        <Pressable key={c.id} style={styles.categoryRow} onLongPress={() => !c.isDefault && confirmRemove(c.name, () => removeCategory(c.id))}>
                            <Ionicons name={c.icon as any} size={14} color={c.color} />
                            <Text style={styles.categoryName}>{c.name}</Text>
                            {c.monthlyTarget ? <Text style={styles.billMeta}>Target {symbol}{c.monthlyTarget}</Text> : null}
                        </Pressable>
                    ))}
                    <QuickAddRow
                        namePlaceholder="New expense category"
                        amountPlaceholder="Monthly target (optional)"
                        onAdd={(name, amount) => addCategory({ name, type: 'expense', icon: 'ellipse', color: '#94a3b8', monthlyTarget: amount > 0 ? amount : undefined })}
                    />
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    sectionCard: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    memberName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
    memberRole: { color: Colors.textFaint, fontSize: 11, textTransform: 'capitalize' },
    roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    roleChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    roleChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    roleChipText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
    roleChipTextActive: { color: Colors.primary },
    billRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    billName: { color: Colors.text, fontSize: 13, flex: 1 },
    billMeta: { color: Colors.textMuted, fontSize: 12 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    categoryName: { color: Colors.text, fontSize: 13, flex: 1 },
    hint: { color: Colors.textFaint, fontSize: 11 },
});
