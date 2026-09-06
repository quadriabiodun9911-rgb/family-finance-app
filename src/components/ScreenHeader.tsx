import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing } from '../theme/colors';

export default function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
    const navigation = useNavigation();
    const canGoBack = navigation.canGoBack();
    return (
        <View style={styles.row}>
            <View style={styles.left}>
                {canGoBack && (
                    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={22} color={Colors.text} />
                    </Pressable>
                )}
                <View>
                    <Text style={styles.title}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
            </View>
            {right}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    backBtn: { padding: 2 },
    title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
});
