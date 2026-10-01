import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { encode } from 'base64-arraybuffer';

// Mirrors readTextFile.ts's web/native split for DocumentPicker results
// (used here for a PDF statement, where expo-document-picker gives a web
// `File` object with no built-in base64 helper, vs. a file:// URI on
// native that expo-file-system can read directly). Image picks from
// expo-image-picker don't need this -- that picker has its own
// `base64: true` option.
export async function readPickedFileAsBase64(result: { uri: string; file?: File }): Promise<string> {
    if (Platform.OS === 'web' && result.file) {
        const buffer = await result.file.arrayBuffer();
        return encode(buffer);
    }
    return FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
}
