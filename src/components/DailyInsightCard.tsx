import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Insight } from '../types';

const SEVERITY_META: Record<Insight['severity'], { icon: any; color: string; bg: string }> = {
    good: { icon: 'sparkles', color: Colors.good, bg: Colors.goodMuted },
    watch: { icon: 'alert-circle', color: Colors.watch, bg: Colors.watchMuted },
    warning: { icon: 'warning', color: Colors.warning, bg: Colors.warningMuted },
};

export default function DailyInsightCard({ insight, streak }: { insight: Insight | null; streak: number }) {
    const meta = insight ? SEVERITY_META[insight.severity] : SEVERITY_META.good;
    return (
        <Card style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.eyebrow}>Today's insight</Text>
                {streak > 0 && (
                    <View style={styles.streakPill}>
                        <Ionicons name="flame" size={13} color={Colors.watch} />
                        <Text style={styles.streakText}>{streak}-day streak</Text>
                    </View>
                )}
            </View>
            <View style={styles.body}>
                <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={styles.textWrap}>
                    <Text style={styles.title}>{insight ? insight.title : "You're all caught up"}</Text>
                    <Text style={styles.message}>
                        {insight ? insight.message : 'Nothing needs your attention today — check back tomorrow for a fresh read on your finances.'}
                    </Text>
                </View>
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { gap: Spacing.sm },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eyebrow: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.watchMuted, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
    streakText: { color: Colors.watch, fontSize: 11, fontWeight: '700' },
    body: { flexDirection: 'row', gap: Spacing.sm },
    iconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    textWrap: { flex: 1, gap: 2 },
    title: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    message: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
});
