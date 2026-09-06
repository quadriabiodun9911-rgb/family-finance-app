import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme/colors';
import { MilestoneCandidate } from '../intelligence/milestones';

export default function MilestoneCelebrationModal({ milestone, onClose }: { milestone: MilestoneCandidate | null; onClose: () => void }) {
    return (
        <Modal visible={!!milestone} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Ionicons name={(milestone?.icon as any) || 'trophy'} size={32} color={Colors.watch} />
                    </View>
                    <Text style={styles.title}>{milestone?.title}</Text>
                    <Text style={styles.message}>{milestone?.message}</Text>
                    <Pressable style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>Nice!</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, maxWidth: 360, width: '100%', borderWidth: 1, borderColor: Colors.border },
    iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.watchMuted, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
    title: { color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    message: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    button: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
