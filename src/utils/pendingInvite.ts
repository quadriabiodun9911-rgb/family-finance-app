import AsyncStorage from '@react-native-async-storage/async-storage';

// Carries an invite code entered on the Sign Up screen forward to the
// Household Setup screen, which is a separate conditionally-rendered
// screen the user lands on only after auth succeeds -- there's no
// navigation params between them. Persisted (not just in-memory) because
// a project with email confirmation on sends the user away to their inbox
// between signing up and actually landing on Household Setup.
const KEY = 'pending_invite_code';

export async function setPendingInviteCode(code: string): Promise<void> {
    await AsyncStorage.setItem(KEY, code);
}

export async function consumePendingInviteCode(): Promise<string | null> {
    const code = await AsyncStorage.getItem(KEY);
    if (code) await AsyncStorage.removeItem(KEY);
    return code;
}
