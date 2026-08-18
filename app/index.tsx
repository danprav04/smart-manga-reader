import React, { useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { useRouter } from 'expo-router';

import { useSettings } from '../src/store/settingsStore';
import { useBreakdown } from '../src/store/breakdownStore';
import { readerConfig } from '../src/config/readerConfig';
import { captureWebView } from '../src/services/screenshotService';
import { analyzeScreenshot } from '../src/services/aiService';
import { hasBreakdownForUrl, getBreakdownByUrl, saveBreakdown } from '../src/services/databaseService';

import { FloatingActionButton } from '../src/components/FloatingActionButton';
import { OverlayLayer } from '../src/components/OverlayLayer';
import { BreakdownSheet, BreakdownSheetRef } from '../src/components/BreakdownSheet';

export default function ReaderScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const { state, dispatch } = useBreakdown();
  
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const sheetRef = useRef<BreakdownSheetRef>(null);

  const [currentUrl, setCurrentUrl] = useState(settings.readerBaseUrl || readerConfig.defaultUrl);

  const handleNavigationStateChange = async (navState: any) => {
    const url = navState.url;
    setCurrentUrl(url);
    
    // Check if we have a cached breakdown for this new URL
    try {
      const hasCache = await hasBreakdownForUrl(url);
      dispatch({ type: 'SET_URL', payload: { url, hasCache } });
    } catch (e) {
      console.error("Failed to check cache for url", e);
    }
  };

  const performAnalysis = async (urlToAnalyze: string, reanalyze = false) => {
    if (state.isAnalyzing) return;
    
    if (!reanalyze && state.hasCachedBreakdown) {
      // Load from cache
      try {
        const cached = await getBreakdownByUrl(urlToAnalyze);
        if (cached) {
          dispatch({ type: 'LOAD_CACHED', payload: cached });
          return;
        }
      } catch (e) {
        console.error("Failed to load cached breakdown", e);
      }
    }

    // Capture and analyze
    try {
      dispatch({ type: 'START_ANALYSIS' });
      
      const { uri, base64 } = await captureWebView(viewShotRef.current);
      
      const result = await analyzeScreenshot(base64, settings);
      
      // Save to SQLite
      const domain = new URL(urlToAnalyze).hostname;
      await saveBreakdown(urlToAnalyze, domain, result, uri);
      
      dispatch({ type: 'ANALYSIS_COMPLETE', payload: { result, screenshotUri: uri } });
    } catch (e: any) {
      console.error("Analysis failed:", e);
      Alert.alert("Analysis Failed", e.message || "Something went wrong.");
      dispatch({ type: 'ANALYSIS_ERROR', payload: e.message });
    }
  };

  const handleFabPress = () => {
    performAnalysis(currentUrl);
  };

  const handleReanalyze = () => {
    performAnalysis(currentUrl, true);
  };

  const handleRegionTap = (regionIndex: number) => {
    sheetRef.current?.expandToHalf();
    setTimeout(() => {
      sheetRef.current?.scrollToRegion(regionIndex);
    }, 100); // small delay to allow expansion
  };

  return (
    <SafeAreaView style={styles.container}>
      <ViewShot ref={viewShotRef} style={styles.container} options={{ format: 'png', quality: 0.9 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: settings.readerBaseUrl || readerConfig.defaultUrl }}
          userAgent={readerConfig.userAgent}
          onNavigationStateChange={handleNavigationStateChange}
          {...readerConfig.webViewProps}
          style={styles.webview}
          injectedJavaScript={
            readerConfig.injectedCSS 
              ? \`
                const style = document.createElement('style');
                style.innerHTML = \`\${readerConfig.injectedCSS}\`;
                document.head.appendChild(style);
                true;
              \`
              : undefined
          }
        />
      </ViewShot>

      {!state.overlayVisible && (
        <FloatingActionButton 
          onPress={handleFabPress}
          isLoading={state.isAnalyzing}
          hasCachedBreakdown={state.hasCachedBreakdown}
        />
      )}

      {/* Renders over everything when active */}
      <OverlayLayer 
        onRegionTap={handleRegionTap}
        onDismiss={() => dispatch({ type: 'DISMISS_OVERLAY' })}
        onReanalyze={handleReanalyze}
      />

      <BreakdownSheet ref={sheetRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
});
