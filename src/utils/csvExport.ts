import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

// Web can trigger a browser download directly. Native has no filesystem
// "save" concept without a picker, so it writes to cache and hands off to
// the OS share sheet instead -- Share.share is built into react-native,
// no extra dependency needed.
export async function exportCsv(filename: string, rows: Record<string, unknown>[]): Promise<void> {
    const csv = Papa.unparse(rows);
    if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        const path = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Share.share({ url: path, title: filename });
    }
}
