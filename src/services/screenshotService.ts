import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';

export const captureWebView = async (viewRef: any): Promise<{ uri: string; base64: string }> => {
  try {
    // Capture the view as a temporary file
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 0.9,
    });

    // We also need it as a persistent file if we want to store it across app restarts
    const filename = uri.split('/').pop();
    const persistentUri = FileSystem.documentDirectory + (filename || `screenshot_${Date.now()}.png`);
    
    await FileSystem.copyAsync({
      from: uri,
      to: persistentUri,
    });

    // Read it as base64 for the AI API
    const base64 = await FileSystem.readAsStringAsync(persistentUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { uri: persistentUri, base64 };
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    throw error;
  }
};
