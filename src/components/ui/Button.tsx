import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';

interface Props {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
}

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
    const bg = variant === 'primary' ? Colors.primary
        : variant === 'danger' ? Colors.warning
        : variant === 'secondary' ? Colors.surfaceAlt
        : 'transparent';
    const textColor = variant === 'ghost' ? Colors.primary : '#fff';
    const borderColor = variant === 'ghost' ? Colors.primary : (variant === 'secondary' ? Colors.border : bg);

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
                style,
            ]}
        >
            {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: Radius.md,
        borderWidth: 1,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: { fontSize: 15, fontWeight: '600' },
});
