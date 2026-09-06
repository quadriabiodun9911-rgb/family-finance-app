import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, FormField } from '../components/ui';
import { Colors, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';

const CURRENCIES = [
    { code: 'NGN', symbol: '₦' },
    { code: 'USD', symbol: '$' },
    { code: 'GBP', symbol: '£' },
    { code: 'EUR', symbol: '€' },
];

export default function OnboardingScreen() {
    const { completeOnboarding } = useFinance();
    const [householdName, setHouseholdName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [currency, setCurrency] = useState(CURRENCIES[0]);
    const [saving, setSaving] = useState(false);

    const canContinue = householdName.trim().length > 0 && ownerName.trim().length > 0;

    const handleContinue = async () => {
        if (!canContinue) return;
        setSaving(true);
        await completeOnboarding(householdName.trim(), ownerName.trim(), currency.code, currency.symbol);
        setSaving(false);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <View style={styles.hero}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="pulse" size={30} color={Colors.primary} />
                        </View>
                        <Text style={styles.title}>Family Finance Intelligence</Text>
                        <Text style={styles.subtitle}>Know your money. Plan your future. Make better financial decisions together.</Text>
                    </View>

                    <View style={styles.form}>
                        <FormField label="Household name" placeholder="e.g. The Johnson Family" value={householdName} onChangeText={setHouseholdName} />
                        <FormField label="Your name" placeholder="e.g. Alex" value={ownerName} onChangeText={setOwnerName} />

                        <View style={styles.currencyWrap}>
                            <Text style={styles.currencyLabel}>Currency</Text>
                            <View style={styles.currencyRow}>
                                {CURRENCIES.map((c) => (
                                    <Button
                                        key={c.code}
                                        label={`${c.symbol} ${c.code}`}
                                        variant={currency.code === c.code ? 'primary' : 'secondary'}
                                        onPress={() => setCurrency(c)}
                                        style={styles.currencyBtn}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>

                    <Button label="Get started" onPress={handleContinue} disabled={!canContinue} loading={saving} />
                    <Text style={styles.footnote}>You can add partners, kids, and more accounts anytime from Settings.</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.xl, gap: Spacing.xl, flexGrow: 1, justifyContent: 'center' },
    hero: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    iconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    title: { color: Colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
    subtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.md },
    form: { gap: Spacing.lg },
    currencyWrap: { gap: Spacing.xs },
    currencyLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    currencyBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    footnote: { color: Colors.textFaint, fontSize: 12, textAlign: 'center' },
});
