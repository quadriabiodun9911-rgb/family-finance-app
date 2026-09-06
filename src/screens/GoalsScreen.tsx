import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GoalCard from '../components/GoalCard';
import { EmptyState } from '../components/ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { computeAllGoalPaces } from '../intelligence/goalPace';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GoalsScreen() {
    const navigation = useNavigation<Nav>();
    const { household, goals } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const paces = useMemo(() => computeAllGoalPaces(goals, symbol), [goals, symbol]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Goals</Text>
                <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddGoal')}>
                    <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                {paces.length === 0 && (
                    <EmptyState icon="flag-outline" title="No goals yet" message="Set a house deposit, emergency fund, or debt payoff target — the intelligence engine will tell you if you're on pace." />
                )}
                {paces.map((pace) => (
                    <GoalCard key={pace.goal.id} pace={pace} symbol={symbol} onPress={() => navigation.navigate('GoalDetail', { goalId: pace.goal.id })} />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
    addBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
});
