import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import QuickAddRow from '../components/QuickAddRow';
import { Card, Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { MemberPermission, MemberRole } from '../types';

const ROLE_OPTIONS: { role: MemberRole; permission: MemberPermission; label: string }[] = [
    { role: 'partner', permission: 'shared', label: 'Partner (shared)' },
    { role: 'teen', permission: 'own', label: 'Teen (own only)' },
    { role: 'child', permission: 'own', label: 'Child (own only)' },
    { role: 'partner', permission: 'full', label: 'Co-owner (full view)' },
];

export default function HouseholdScreen() {
    const {
        household, members, myPermission, pendingInvites, inviteMember, removeMember,
        categories, addCategory, removeCategory, recurringBills, addRecurringBill, removeRecurringBill,
    } = useFinance();
    const { signOut, user } = useAuth();
    const symbol = household?.currencySymbol || '$';
    const [inviteEmail, setInviteEmail] = useState('');
    const [newRole, setNewRole] = useState(ROLE_OPTIONS[0]);
    const [lastCode, setLastCode] = useState<string | null>(null);
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    const confirmRemove = (label: string, fn: () => void) => Alert.alert('Remove', `Remove ${label}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: fn }]);

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setInviting(true);
        setInviteError(null);
        const result = await inviteMember(inviteEmail.trim(), newRole.role, newRole.permission);
        setInviting(false);
        if (result.error) { setInviteError(result.error); return; }
        setLastCode(result.code);
        setInviteEmail('');
    };

    const shareCode = (code: string) => {
        Share.share({ message: `Join our household on Family Finance! Use invite code: ${code}` }).catch(() => {});
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="Household" subtitle={household?.name} />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Family members</Text>
                    {members.map((m) => (
                        <Pressable key={m.id} style={styles.memberRow} onLongPress={() => m.userId !== user?.id && myPermission === 'full' && confirmRemove(m.name, () => removeMember(m.id))}>
                            <View style={[styles.avatar, { backgroundColor: m.color }]}><Text style={styles.avatarText}>{m.name[0]?.toUpperCase()}</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.memberName}>{m.name}{m.userId === user?.id ? ' (you)' : ''}</Text>
                                <Text style={styles.memberRole}>{m.role} · {m.permission === 'full' ? 'sees everything' : m.permission === 'shared' ? 'shared + own' : 'own only'}</Text>
                            </View>
                        </Pressable>
                    ))}

                    {myPermission === 'full' ? (
                        <>
                            <View style={styles.roleChipRow}>
                                {ROLE_OPTIONS.map((opt) => (
                                    <Pressable key={opt.label} onPress={() => setNewRole(opt)} style={[styles.roleChip, newRole.label === opt.label && styles.roleChipActive]}>
                                        <Text style={[styles.roleChipText, newRole.label === opt.label && styles.roleChipTextActive]}>{opt.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <FormField label="Their email" placeholder="partner@example.com" autoCapitalize="none" keyboardType="email-address" value={inviteEmail} onChangeText={setInviteEmail} />
                            <Button label={inviting ? 'Sending…' : 'Send invite'} variant="secondary" onPress={handleInvite} disabled={!inviteEmail.trim() || inviting} />
                            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
                            {lastCode ? (
                                <Pressable style={styles.codeBox} onPress={() => shareCode(lastCode)}>
                                    <Text style={styles.codeLabel}>Invite code — tap to share</Text>
                                    <Text style={styles.codeValue}>{lastCode}</Text>
                                </Pressable>
                            ) : null}
                            {pendingInvites.length > 0 && (
                                <View style={{ gap: 4, marginTop: Spacing.xs }}>
                                    <Text style={styles.pendingLabel}>Pending invites</Text>
                                    {pendingInvites.map((inv) => (
                                        <Pressable key={inv.id} style={styles.pendingRow} onPress={() => shareCode(inv.inviteCode)}>
                                            <Ionicons name="mail-outline" size={13} color={Colors.textMuted} />
                                            <Text style={styles.pendingEmail}>{inv.email}</Text>
                                            <Text style={styles.pendingCode}>{inv.inviteCode}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <Text style={styles.hint}>Only a full-access member can invite others.</Text>
                    )}
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

                <Pressable onPress={() => signOut()} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
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
    errorText: { color: Colors.warning, fontSize: 12 },
    codeBox: { backgroundColor: Colors.primaryMuted, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 2 },
    codeLabel: { color: Colors.textMuted, fontSize: 11 },
    codeValue: { color: Colors.primary, fontSize: 20, fontWeight: '800', letterSpacing: 2 },
    pendingLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
    pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    pendingEmail: { color: Colors.text, fontSize: 12, flex: 1 },
    pendingCode: { color: Colors.textFaint, fontSize: 12, fontWeight: '700' },
    billRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    billName: { color: Colors.text, fontSize: 13, flex: 1 },
    billMeta: { color: Colors.textMuted, fontSize: 12 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    categoryName: { color: Colors.text, fontSize: 13, flex: 1 },
    hint: { color: Colors.textFaint, fontSize: 11 },
    signOutBtn: { alignItems: 'center', paddingVertical: Spacing.md },
    signOutText: { color: Colors.textFaint, fontSize: 13 },
});
