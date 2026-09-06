import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// expo-document-picker gives a web `File` object on web (has its own .text())
// and a file:// URI on native, which needs expo-file-system to read.
export async function readPickedFileAsText(result: { uri: string; file?: File }): Promise<string> {
    if (Platform.OS === 'web' && result.file) {
        return result.file.text();
    }
    return FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.UTF8 });
}
