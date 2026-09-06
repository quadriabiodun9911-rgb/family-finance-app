import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../theme/colors';

export default function EmptyState({ icon = 'sparkles-outline', title, message }: { icon?: any; title: string; message: string }) {
    return (
        <View style={styles.wrap}>
            <Ionicons name={icon} size={32} color={Colors.textFaint} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
    title: { color: Colors.text, fontSize: 15, fontWeight: '700' },
    message: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
