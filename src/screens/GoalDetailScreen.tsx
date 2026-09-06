import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { Card, ProgressBar, Button } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeGoalPace } from '../intelligence/goalPace';
import { formatMoney } from '../utils/currency';
import { shortDate } from '../utils/date';
import { RootStackParamList } from '../navigation/types';

export default function GoalDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<RootStackParamList, 'GoalDetail'>>();
    const { household, goals, contributeToGoal, removeGoal } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const goal = goals.find((g) => g.id === route.params.goalId);
    const [amount, setAmount] = useState('');

    const pace = useMemo(() => goal ? computeGoalPace(goal, symbol) : null, [goal, symbol]);

    if (!goal || !pace) {
        return (
            <SafeAreaView style={styles.safe}>
                <ScreenHeader title="Goal" />
                <Text style={styles.missing}>This goal was removed.</Text>
            </SafeAreaView>
        );
    }

    const isDebt = goal.type === 'debt';
    const handleContribute = () => {
        const value = parseFloat(amount);
        if (Number.isNaN(value) || value <= 0) return;
        contributeToGoal(goal.id, isDebt ? -value : value);
        setAmount('');
    };

    const handleDelete = () => {
        Alert.alert('Delete goal', `Remove "${goal.title}"? This can't be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { removeGoal(goal.id); navigation.goBack(); } },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title={goal.title} right={<Pressable onPress={handleDelete}><Ionicons name="trash-outline" size={20} color={Colors.warning} /></Pressable>} />
            <ScrollView contentContainerStyle={styles.container}>
                <Card style={styles.progressCard}>
                    <Text style={styles.amounts}>{formatMoney(goal.currentValue, symbol)} <Text style={styles.of}>of {formatMoney(goal.targetValue, symbol)}</Text></Text>
                    <ProgressBar pct={pace.progressPct} color={pace.onTrack === false ? Colors.watch : Colors.good} height={10} />
                    <Text style={styles.narrative}>{pace.narrative}</Text>
                </Card>

                <Card style={styles.contributeCard}>
                    <Text style={styles.sectionTitle}>{isDebt ? 'Log a payment' : 'Add a contribution'}</Text>
                    <View style={styles.contributeRow}>
                        <TextInput
                            style={styles.input}
                            placeholder={`Amount (${symbol})`}
                            placeholderTextColor={Colors.textFaint}
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                        <Button label={isDebt ? 'Pay down' : 'Add'} onPress={handleContribute} style={{ paddingHorizontal: Spacing.lg }} />
                    </View>
                </Card>

                <View style={styles.historyWrap}>
                    <Text style={styles.sectionTitle}>History</Text>
                    {goal.contributions.length === 0 && <Text style={styles.emptyHistory}>No contributions logged yet.</Text>}
                    {goal.contributions.map((c) => (
                        <View key={c.id} style={styles.historyRow}>
                            <Text style={styles.historyDate}>{shortDate(c.date)}</Text>
                            <Text style={[styles.historyAmount, { color: c.amount >= 0 ? Colors.good : Colors.warning }]}>
                                {c.amount >= 0 ? '+' : ''}{formatMoney(c.amount, symbol)}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    missing: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
    progressCard: { gap: Spacing.sm },
    amounts: { color: Colors.text, fontSize: 22, fontWeight: '800' },
    of: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
    narrative: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
    contributeCard: { gap: Spacing.sm },
    sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    contributeRow: { flexDirection: 'row', gap: Spacing.sm },
    input: { flex: 1, minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, color: Colors.text },
    historyWrap: { gap: Spacing.xs },
    emptyHistory: { color: Colors.textFaint, fontSize: 13 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
    historyDate: { color: Colors.textMuted, fontSize: 13 },
    historyAmount: { fontSize: 13, fontWeight: '700' },
});
