import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';
import Card from './Card';

interface Props {
    label: string;
    value: string;
    valueColor?: string;
    sub?: string;
    flex?: number;
}

export default function StatCard({ label, value, valueColor, sub, flex }: Props) {
    return (
        <Card style={[styles.card, flex ? { flex } : undefined]}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.md, borderRadius: Radius.md, gap: 4 },
    label: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    value: { color: Colors.text, fontSize: 20, fontWeight: '700' },
    sub: { color: Colors.textFaint, fontSize: 12 },
});
