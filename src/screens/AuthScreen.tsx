import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, FormField } from '../components/ui';
import { Colors, Spacing } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<Mode>('signIn');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const canSubmit = email.trim().length > 3 && password.length >= 6;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setError(null); setInfo(null); setLoading(true);
        const result = mode === 'signIn' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
        setLoading(false);
        if (result.error) { setError(result.error); return; }
        if (mode === 'signUp') setInfo('Account created. If email confirmation is required, check your inbox before signing in.');
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

                    <View style={styles.modeToggle}>
                        <Button label="Sign in" variant={mode === 'signIn' ? 'primary' : 'secondary'} onPress={() => setMode('signIn')} style={styles.modeBtn} />
                        <Button label="Sign up" variant={mode === 'signUp' ? 'primary' : 'secondary'} onPress={() => setMode('signUp')} style={styles.modeBtn} />
                    </View>

                    <View style={styles.form}>
                        <FormField label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
                        <FormField label="Password" placeholder="At least 6 characters" secureTextEntry value={password} onChangeText={setPassword} />
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {info ? <Text style={styles.infoText}>{info}</Text> : null}

                    <Button label={mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={handleSubmit} disabled={!canSubmit} loading={loading} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.xl, gap: Spacing.lg, flexGrow: 1, justifyContent: 'center' },
    hero: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    iconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    subtitle: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.md },
    modeToggle: { flexDirection: 'row', gap: Spacing.sm },
    modeBtn: { flex: 1 },
    form: { gap: Spacing.md },
    errorText: { color: Colors.warning, fontSize: 13 },
    infoText: { color: Colors.good, fontSize: 13 },
});
