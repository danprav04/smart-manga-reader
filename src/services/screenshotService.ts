import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { logger, LogCategory } from '../utils/logger';

export const captureWebView = async (viewRef: any): Promise<{ uri: string; base64: string }> => {
  try {
    logger.info(LogCategory.SCREENSHOT, 'Starting WebView screenshot capture...');
    const startTime = Date.now();
    
    // Capture the view as a temporary file
    const uri = await captureRef(viewRef, {
      format: 'jpg',
      quality: 0.9,
    });
    logger.debug(LogCategory.SCREENSHOT, `Captured temporary screenshot at ${uri}`);

    // Compress and resize the image to save bandwidth and AI tokens
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    logger.debug(LogCategory.SCREENSHOT, `Resized and compressed screenshot to width 1024, quality 0.7`);

    // We also need it as a persistent file if we want to store it across app restarts
    const filename = manipResult.uri.split('/').pop();
    const persistentUri = FileSystem.documentDirectory + (filename || `screenshot_${Date.now()}.jpg`);
    
    await FileSystem.copyAsync({
      from: manipResult.uri,
      to: persistentUri,
    });
    logger.debug(LogCategory.SCREENSHOT, `Copied screenshot to persistent storage at ${persistentUri}`);

    const base64 = manipResult.base64 || await FileSystem.readAsStringAsync(persistentUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const elapsed = Date.now() - startTime;
    logger.info(LogCategory.SCREENSHOT, `Screenshot captured successfully in ${elapsed}ms. Base64 length: ${base64.length}`);

    return { uri: persistentUri, base64 };
  } catch (error) {
    logger.error(LogCategory.SCREENSHOT, 'Failed to capture screenshot', error);
    throw error;
  }
};
