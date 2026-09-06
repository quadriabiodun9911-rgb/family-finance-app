import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { generateId } from './id';

// Web picks give a blob:/data: URI fetch() can read directly; native picks
// give a file:// URI that needs expo-file-system's base64 read instead --
// there is no cross-platform `fetch(file://...)` on native.
export async function uploadReceiptImage(householdId: string, localUri: string): Promise<string> {
    const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const path = `${householdId}/${generateId()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    if (Platform.OS === 'web') {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('receipts').upload(path, blob, { contentType });
        if (error) throw error;
    } else {
        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
        const { error } = await supabase.storage.from('receipts').upload(path, decode(base64), { contentType });
        if (error) throw error;
    }
    return path;
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
    if (error || !data) return null;
    return data.signedUrl;
}
