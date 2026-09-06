import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ITEMS: { key: keyof RootStackParamList; label: string; icon: any }[] = [
    { key: 'Household', label: 'Household & Members', icon: 'people' },
    { key: 'SavingsInvestments', label: 'Savings, Investments & Net Worth', icon: 'diamond' },
    { key: 'Analysis', label: 'Spending Analysis', icon: 'analytics' },
    { key: 'Reports', label: 'Daily · Weekly · Monthly Reports', icon: 'newspaper' },
    { key: 'IncomeInsights', label: 'Income Intelligence', icon: 'rocket' },
    { key: 'Coach', label: 'Ask the Coach', icon: 'chatbubble-ellipses' },
    { key: 'RiskDecision', label: 'Risk & Decisions', icon: 'shield-half' },
    { key: 'DebtIntelligence', label: 'Debt & Mortgage Intelligence', icon: 'card' },
];

export default function MoreScreen() {
    const navigation = useNavigation<Nav>();
    const { household } = useFinance();

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>More</Text>
                <Text style={styles.subtitle}>{household?.name}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.container}>
                {ITEMS.map((item) => (
                    <Pressable key={item.key} style={styles.row} onPress={() => navigation.navigate(item.key as any)}>
                        <View style={styles.iconWrap}><Ionicons name={item.icon} size={18} color={Colors.primary} /></View>
                        <Text style={styles.label}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
                    </Pressable>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
    title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
    subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
    container: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    iconWrap: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    label: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
});
