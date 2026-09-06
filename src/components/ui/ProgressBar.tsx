import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../theme/colors';

interface Props {
    pct: number; // 0-100, can exceed 100
    color?: string;
    trackColor?: string;
    height?: number;
}

export default function ProgressBar({ pct, color = Colors.primary, trackColor = Colors.surfaceAlt, height = 8 }: Props) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
            <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: { width: '100%', overflow: 'hidden' },
    fill: { height: '100%' },
});
