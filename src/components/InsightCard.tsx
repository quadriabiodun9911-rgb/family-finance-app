import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Insight } from '../types';

const ICONS: Record<Insight['severity'], { name: any; color: string; bg: string }> = {
    good: { name: 'checkmark-circle', color: Colors.good, bg: Colors.goodMuted },
    watch: { name: 'alert-circle', color: Colors.watch, bg: Colors.watchMuted },
    warning: { name: 'warning', color: Colors.warning, bg: Colors.warningMuted },
};

export default function InsightCard({ insight }: { insight: Insight }) {
    const meta = ICONS[insight.severity];
    return (
        <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.name} size={16} color={meta.color} />
            </View>
            <View style={styles.textWrap}>
                <Text style={styles.title}>{insight.title}</Text>
                <Text style={styles.message}>{insight.message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm },
    iconWrap: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    textWrap: { flex: 1, gap: 2 },
    title: { color: Colors.text, fontSize: 14, fontWeight: '700' },
    message: { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
});
