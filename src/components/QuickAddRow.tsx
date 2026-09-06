import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme/colors';

export default function QuickAddRow({ namePlaceholder, amountPlaceholder, onAdd, showAmount = true }: {
    namePlaceholder: string; amountPlaceholder: string; onAdd: (name: string, amount: number) => void; showAmount?: boolean;
}) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');

    const submit = () => {
        const value = showAmount ? parseFloat(amount) : 0;
        if (!name.trim() || (showAmount && Number.isNaN(value))) return;
        onAdd(name.trim(), value);
        setName('');
        setAmount('');
    };

    return (
        <View style={styles.row}>
            <TextInput style={[styles.input, { flex: showAmount ? 2 : 1 }]} placeholder={namePlaceholder} placeholderTextColor={Colors.textFaint} value={name} onChangeText={setName} />
            {showAmount && (
                <TextInput style={[styles.input, { flex: 1 }]} placeholder={amountPlaceholder} placeholderTextColor={Colors.textFaint} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            )}
            <Pressable style={styles.addBtn} onPress={submit}>
                <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    input: { minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text },
    addBtn: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
