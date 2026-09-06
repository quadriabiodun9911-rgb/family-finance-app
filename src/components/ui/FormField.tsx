import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';

interface Props extends TextInputProps {
    label: string;
}

export default function FormField({ label, style, ...rest }: Props) {
    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                placeholderTextColor={Colors.textFaint}
                style={[styles.input, style]}
                {...rest}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.xs },
    label: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    input: {
        backgroundColor: Colors.surfaceAlt,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        color: Colors.text,
        fontSize: 15,
    },
});
