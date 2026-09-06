import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { parseQuickAddText } from '../utils/quickAddParser';
import { formatMoney } from '../utils/currency';
import { todayISO, nowTimeHHMM } from '../utils/date';

export default function QuickAddTextBar() {
    const { household, categories, addTransaction } = useFinance();
    const symbol = household?.currencySymbol || '$';
    const [text, setText] = useState('');
    const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

    const handleSend = () => {
        const result = parseQuickAddText(text, categories);
        if (!result.ok) {
            setFeedback({ ok: false, message: result.error });
            return;
        }
        if (!result.categoryId) {
            setFeedback({ ok: false, message: `No ${result.type} categories set up yet — add one in Household settings first.` });
            return;
        }
        addTransaction({
            date: todayISO(),
            type: result.type,
            amount: result.amount,
            categoryId: result.categoryId,
            ownership: 'shared',
            description: result.description,
            isRecurring: false,
            time: nowTimeHHMM(),
        });
        const sign = result.type === 'income' ? '+' : '-';
        setFeedback({ ok: true, message: `Added ${sign}${formatMoney(result.amount, symbol)} · ${result.categoryLabel}` });
        setText('');
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>Quick add</Text>
            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    placeholder='e.g. "Spent 5000 on groceries"'
                    placeholderTextColor={Colors.textFaint}
                    value={text}
                    onChangeText={(v) => { setText(v); if (feedback) setFeedback(null); }}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                />
                <Pressable style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!text.trim()}>
                    <Ionicons name="send" size={16} color="#fff" />
                </Pressable>
            </View>
            {feedback ? (
                <Text style={[styles.feedback, { color: feedback.ok ? Colors.good : Colors.warning }]}>{feedback.message}</Text>
            ) : (
                <Text style={styles.hint}>Type it like a text — amount, and what it was for.</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.xs },
    label: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    input: {
        flex: 1, minWidth: 0, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, color: Colors.text, fontSize: 14,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
    feedback: { fontSize: 12, fontWeight: '600', paddingLeft: Spacing.sm },
    hint: { color: Colors.textFaint, fontSize: 11, paddingLeft: Spacing.sm },
});
