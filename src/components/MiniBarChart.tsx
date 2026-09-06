import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme/colors';

export interface BarDatum {
    label: string;
    value: number;
    highlight?: boolean;
}

export default function MiniBarChart({ data, color = Colors.primary }: { data: BarDatum[]; color?: string }) {
    const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
    return (
        <View style={styles.row}>
            {data.map((d, i) => {
                const heightPct = Math.max(4, (Math.abs(d.value) / max) * 100);
                return (
                    <View key={i} style={styles.col}>
                        <View style={styles.barTrack}>
                            <View style={[styles.bar, { height: `${heightPct}%`, backgroundColor: d.highlight ? Colors.watch : color }]} />
                        </View>
                        <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: Spacing.sm },
    col: { flex: 1, alignItems: 'center', gap: Spacing.xs, height: '100%', justifyContent: 'flex-end' },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 6, minHeight: 4 },
    label: { color: Colors.textFaint, fontSize: 10 },
});
