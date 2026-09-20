import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';

export interface ActionSheetOption {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    cancel?: boolean;
}

export interface ActionSheetRequest {
    title?: string;
    message?: string;
    options: ActionSheetOption[];
}

interface ActionSheetContextValue {
    show: (request: ActionSheetRequest) => void;
    confirm: (opts: { title?: string; message?: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void }) => void;
    notice: (opts: { title?: string; message?: string; onDismiss?: () => void }) => void;
}

const ActionSheetContext = createContext<ActionSheetContextValue | undefined>(undefined);

// react-native's Alert.alert has no real implementation on react-native-web
// -- its buttons array (and every onPress inside it) is silently dropped,
// so a Cancel/Delete confirm or a multi-option action sheet shows nothing
// interactive when this app runs in a browser, which is its primary
// deployment target (Vercel). This is a from-scratch replacement built on
// Modal, which does work correctly on web, native, and everywhere else.
export function ActionSheetProvider({ children }: { children: React.ReactNode }) {
    const [request, setRequest] = useState<ActionSheetRequest | null>(null);

    const show = useCallback((r: ActionSheetRequest) => setRequest(r), []);
    const close = useCallback(() => setRequest(null), []);

    const confirm = useCallback((opts: { title?: string; message?: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void }) => {
        setRequest({
            title: opts.title,
            message: opts.message,
            options: [
                { label: opts.confirmLabel || 'Confirm', destructive: opts.destructive ?? true, onPress: opts.onConfirm },
                { label: 'Cancel', cancel: true, onPress: () => {} },
            ],
        });
    }, []);

    const notice = useCallback((opts: { title?: string; message?: string; onDismiss?: () => void }) => {
        setRequest({ title: opts.title, message: opts.message, options: [{ label: 'OK', onPress: opts.onDismiss || (() => {}) }] });
    }, []);

    const handlePress = (opt: ActionSheetOption) => {
        close();
        opt.onPress();
    };

    return (
        <ActionSheetContext.Provider value={{ show, confirm, notice }}>
            {children}
            <Modal visible={!!request} transparent animationType="fade" onRequestClose={close}>
                <View style={styles.overlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                    <View style={styles.sheet}>
                        {(request?.title || request?.message) && (
                            <View style={styles.header}>
                                {request?.title ? <Text style={styles.title}>{request.title}</Text> : null}
                                {request?.message ? <Text style={styles.message}>{request.message}</Text> : null}
                            </View>
                        )}
                        {request?.options.map((opt, i) => (
                            <Pressable
                                key={i}
                                style={({ pressed }) => [styles.optionRow, i > 0 && styles.optionBorder, pressed && styles.optionPressed]}
                                onPress={() => handlePress(opt)}
                            >
                                <Text style={[styles.optionText, opt.destructive && styles.destructiveText, opt.cancel && styles.cancelText]}>{opt.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </Modal>
        </ActionSheetContext.Provider>
    );
}

export function useActionSheet(): ActionSheetContextValue {
    const ctx = useContext(ActionSheetContext);
    if (!ctx) throw new Error('useActionSheet must be used within an ActionSheetProvider');
    return ctx;
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0, paddingBottom: Spacing.xl, overflow: 'hidden' },
    header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 2 },
    title: { color: Colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    message: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
    optionRow: { paddingVertical: Spacing.md, alignItems: 'center' },
    optionBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
    optionPressed: { backgroundColor: Colors.surfaceAlt },
    optionText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
    destructiveText: { color: Colors.warning },
    cancelText: { color: Colors.textMuted, fontWeight: '700' },
});
