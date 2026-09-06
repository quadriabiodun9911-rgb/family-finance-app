import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';

const CURRENCIES = [
    { code: 'NGN', symbol: '₦' },
    { code: 'USD', symbol: '$' },
    { code: 'GBP', symbol: '£' },
    { code: 'EUR', symbol: '€' },
];

type Tab = 'create' | 'join';

export default function HouseholdSetupScreen() {
    const { createHousehold, joinHousehold } = useFinance();
    const { signOut } = useAuth();
    const [tab, setTab] = useState<Tab>('create');

    const [householdName, setHouseholdName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [currency, setCurrency] = useState(CURRENCIES[0]);
    const [saving, setSaving] = useState(false);

    const [inviteCode, setInviteCode] = useState('');
    const [joinName, setJoinName] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);

    const canCreate = householdName.trim().length > 0 && ownerName.trim().length > 0;
    const canJoin = inviteCode.trim().length >= 4 && joinName.trim().length > 0;

    const handleCreate = async () => {
        if (!canCreate) return;
        setSaving(true);
        await createHousehold(householdName.trim(), ownerName.trim(), currency.code, currency.symbol);
        setSaving(false);
    };

    const handleJoin = async () => {
        if (!canJoin) return;
        setJoinError(null);
        setSaving(true);
        const result = await joinHousehold(inviteCode.trim(), joinName.trim());
        setSaving(false);
        if (result.error) setJoinError(result.error);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.hero}>
                    <Text style={styles.title}>One more step</Text>
                    <Text style={styles.subtitle}>Create a new household, or join one you've been invited to.</Text>
                </View>

                <View style={styles.tabRow}>
                    <Pressable style={[styles.tabChip, tab === 'create' && styles.tabChipActive]} onPress={() => setTab('create')}>
                        <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>Create household</Text>
                    </Pressable>
                    <Pressable style={[styles.tabChip, tab === 'join' && styles.tabChipActive]} onPress={() => setTab('join')}>
                        <Text style={[styles.tabText, tab === 'join' && styles.tabTextActive]}>Join with a code</Text>
                    </Pressable>
                </View>

                {tab === 'create' ? (
                    <View style={styles.form}>
                        <FormField label="Household name" placeholder="e.g. The Johnson Family" value={householdName} onChangeText={setHouseholdName} />
                        <FormField label="Your name" placeholder="e.g. Alex" value={ownerName} onChangeText={setOwnerName} />
                        <View style={styles.currencyWrap}>
                            <Text style={styles.currencyLabel}>Currency</Text>
                            <View style={styles.currencyRow}>
                                {CURRENCIES.map((c) => (
                                    <Button key={c.code} label={`${c.symbol} ${c.code}`} variant={currency.code === c.code ? 'primary' : 'secondary'} onPress={() => setCurrency(c)} style={styles.currencyBtn} />
                                ))}
                            </View>
                        </View>
                        <Button label="Create household" onPress={handleCreate} disabled={!canCreate} loading={saving} />
                    </View>
                ) : (
                    <View style={styles.form}>
                        <FormField label="Invite code" placeholder="e.g. 7F3KQ2" autoCapitalize="characters" value={inviteCode} onChangeText={setInviteCode} />
                        <FormField label="Your name" placeholder="e.g. Sam" value={joinName} onChangeText={setJoinName} />
                        {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
                        <Button label="Join household" onPress={handleJoin} disabled={!canJoin} loading={saving} />
                    </View>
                )}

                <Pressable onPress={() => signOut()} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.xl, gap: Spacing.xl, flexGrow: 1, justifyContent: 'center' },
    hero: { alignItems: 'center', gap: Spacing.sm },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    subtitle: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.md },
    tabRow: { flexDirection: 'row', gap: Spacing.sm },
    tabChip: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.pill, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
    tabChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    form: { gap: Spacing.lg },
    currencyWrap: { gap: Spacing.xs },
    currencyLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    currencyBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    errorText: { color: Colors.warning, fontSize: 13 },
    signOutBtn: { alignItems: 'center', paddingTop: Spacing.md },
    signOutText: { color: Colors.textFaint, fontSize: 13 },
});
