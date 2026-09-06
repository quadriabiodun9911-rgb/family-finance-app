import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { Button, FormField } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { GoalIcon, GoalType } from '../types';

const TYPE_OPTIONS: { type: GoalType; icon: GoalIcon; label: string }[] = [
    { type: 'savings', icon: 'home', label: 'House deposit' },
    { type: 'savings', icon: 'shield', label: 'Emergency fund' },
    { type: 'savings', icon: 'school', label: "Children's education" },
    { type: 'debt', icon: 'card', label: 'Debt payoff' },
    { type: 'investment', icon: 'trending-up', label: 'Investment portfolio' },
    { type: 'custom', icon: 'flag', label: 'Custom goal' },
];

const ICON_MAP: Record<GoalIcon, any> = {
    home: 'home', shield: 'shield-checkmark', school: 'school', card: 'card',
    'trending-up': 'trending-up', flag: 'flag', airplane: 'airplane', car: 'car',
};

export default function AddGoalScreen() {
    const navigation = useNavigation();
    const { household, addGoal } = useFinance();
    const symbol = household?.currencySymbol || '$';

    const [selected, setSelected] = useState(TYPE_OPTIONS[0]);
    const [title, setTitle] = useState(TYPE_OPTIONS[0].label);
    const [target, setTarget] = useState('');
    const [current, setCurrent] = useState('');
    const [deadline, setDeadline] = useState(''); // YYYY-MM-DD, optional

    const targetValue = parseFloat(target);
    const currentValue = parseFloat(current || '0');
    const canSave = !Number.isNaN(targetValue) && targetValue > 0 && title.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;
        addGoal({
            type: selected.type,
            icon: selected.icon,
            title: title.trim(),
            targetValue: selected.type === 'debt' ? 0 : targetValue,
            currentValue: selected.type === 'debt' ? targetValue : (Number.isNaN(currentValue) ? 0 : currentValue),
            deadline: deadline.trim() || undefined,
        });
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScreenHeader title="New Goal" />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.chipWrap}>
                    {TYPE_OPTIONS.map((opt) => (
                        <Pressable
                            key={opt.label}
                            style={[styles.chip, selected.label === opt.label && styles.chipActive]}
                            onPress={() => { setSelected(opt); setTitle(opt.label); }}
                        >
                            <Ionicons name={ICON_MAP[opt.icon]} size={14} color={selected.label === opt.label ? Colors.primary : Colors.textMuted} />
                            <Text style={[styles.chipText, selected.label === opt.label && styles.chipTextActive]}>{opt.label}</Text>
                        </Pressable>
                    ))}
                </View>

                <FormField label="Goal name" value={title} onChangeText={setTitle} />
                <FormField
                    label={selected.type === 'debt' ? `Current balance (${symbol})` : `Target amount (${symbol})`}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={target}
                    onChangeText={setTarget}
                />
                {selected.type !== 'debt' && (
                    <FormField label={`Already saved (${symbol})`} placeholder="0" keyboardType="decimal-pad" value={current} onChangeText={setCurrent} />
                )}
                <FormField label="Deadline (YYYY-MM-DD, optional)" placeholder="2027-06-30" value={deadline} onChangeText={setDeadline} />

                <Button label="Create goal" onPress={handleSave} disabled={!canSave} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
    chipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
    chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: Colors.primary },
});
