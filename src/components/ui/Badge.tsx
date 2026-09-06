import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../theme/colors';
import { InsightSeverity } from '../../types';

const SEVERITY_STYLE: Record<InsightSeverity, { bg: string; fg: string; label: string }> = {
    good: { bg: Colors.goodMuted, fg: Colors.good, label: 'Good' },
    watch: { bg: Colors.watchMuted, fg: Colors.watch, label: 'Watch' },
    warning: { bg: Colors.warningMuted, fg: Colors.warning, label: 'Warning' },
};

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
    const s = SEVERITY_STYLE[severity];
    return (
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
        </View>
    );
}

export default function Badge({ label, color = Colors.primary, bg = Colors.primaryMuted }: { label: string; color?: string; bg?: string }) {
    return (
        <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' },
    text: { fontSize: 11, fontWeight: '700' },
});
