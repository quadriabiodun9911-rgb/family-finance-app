import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ProgressBar } from './ui';
import { Colors, Spacing } from '../theme/colors';
import { formatMoney } from '../utils/currency';
import { GoalPace } from '../intelligence/goalPace';

const GOAL_ICON: Record<string, any> = {
    home: 'home', shield: 'shield-checkmark', school: 'school', card: 'card',
    'trending-up': 'trending-up', flag: 'flag', airplane: 'airplane', car: 'car',
};

export default function GoalCard({ pace, symbol, onPress }: { pace: GoalPace; symbol: string; onPress?: () => void }) {
    const { goal, progressPct, narrative } = pace;
    return (
        <Pressable onPress={onPress}>
            <Card style={styles.card}>
                <View style={styles.headerRow}>
                    <View style={styles.iconWrap}>
                        <Ionicons name={GOAL_ICON[goal.icon] || 'flag'} size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{goal.title}</Text>
                        <Text style={styles.sub}>
                            {formatMoney(goal.currentValue, symbol)} of {formatMoney(goal.targetValue, symbol)}
                            {goal.deadline ? ` · by ${new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
                        </Text>
                    </View>
                    <Text style={styles.pct}>{progressPct.toFixed(0)}%</Text>
                </View>
                <ProgressBar pct={progressPct} color={pace.onTrack === false ? Colors.watch : Colors.good} />
                <Text style={styles.narrative}>{narrative}</Text>
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { gap: Spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    title: { color: Colors.text, fontSize: 15, fontWeight: '700' },
    sub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
    pct: { color: Colors.text, fontSize: 15, fontWeight: '700' },
    narrative: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
});
