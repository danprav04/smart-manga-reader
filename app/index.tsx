import React, { useRef, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text as RNText, BackHandler, ActivityIndicator as RNActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { state, dispatch } = useBreakdown();
  
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const sheetRef = useRef<BreakdownSheetRef>(null);
  const lastProcessedUrl = useRef<string | null>(null);

  const [currentUrl, setCurrentUrl] = useState(settings.readerBaseUrl || readerConfig.defaultUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);

  React.useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = async (navState: any) => {
    if (navState.loading) {
      setIsPageLoading(true);
    }
    
    const url = navState.url;
    setCurrentUrl(url);
    setCanGoBack(navState.canGoBack);
    
    // Don't re-dispatch SET_URL if the URL hasn't changed
    if (url === lastProcessedUrl.current) return;
    lastProcessedUrl.current = url;
    
    // Check if we have a cached breakdown for this new URL
    try {
      const hasCache = await hasBreakdownForUrl(url);
      dispatch({ type: 'SET_URL', payload: { url, hasCache } });
    } catch (e) {
      console.error("Failed to check cache for url", e);
    }
  };

  React.useEffect(() => {
    if (webViewRef.current) {
      if (settings.nightReader) {
        webViewRef.current.injectJavaScript(`
          if (!document.getElementById('night-reader-style')) {
            const nightStyle = document.createElement('style');
            nightStyle.id = 'night-reader-style';
            nightStyle.innerHTML = \`
              html { filter: invert(1) hue-rotate(180deg); background-color: #fff !important; }
              img, canvas, video { filter: invert(1) hue-rotate(180deg); }
            \`;
            document.head.appendChild(nightStyle);
          }
          true;
        `);
      } else {
        webViewRef.current.injectJavaScript(`
          const existing = document.getElementById('night-reader-style');
          if (existing) existing.remove();
          true;
        `);
      }
    }
  }, [settings.nightReader]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: settings.darkMode ? '#000' : '#F2F2F7' }]}>
      <ViewShot ref={viewShotRef} style={[styles.container, { backgroundColor: settings.darkMode ? '#000' : '#F2F2F7' }]} options={{ format: 'png', quality: 0.9 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: settings.readerBaseUrl || readerConfig.defaultUrl }}
          userAgent={readerConfig.userAgent}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={(request) => {
            setIsPageLoading(true);
            return true;
          }}
          onLoadStart={() => setIsPageLoading(true)}
          onLoadEnd={() => setIsPageLoading(false)}
          {...readerConfig.webViewProps}
          style={styles.webview}
          injectedJavaScript={
            `
            ${readerConfig.injectedCSS ? `
              const style = document.createElement('style');
              style.innerHTML = \`${readerConfig.injectedCSS}\`;
              document.head.appendChild(style);
            ` : ''}
            ${settings.nightReader ? `
              const nightStyle = document.createElement('style');
              nightStyle.id = 'night-reader-style';
              nightStyle.innerHTML = \`
                html { filter: invert(1) hue-rotate(180deg); background-color: #fff !important; }
                img, canvas, video { filter: invert(1) hue-rotate(180deg); }
              \`;
              document.head.appendChild(nightStyle);
            ` : ''}
            true;
            `
          }
        />
      </ViewShot>

      {/* Page Loading Indicator */}
      {isPageLoading && (
        <View style={[styles.loadingIndicator, { top: Math.max(insets.top, 16) + 16 }]} pointerEvents="none">
          <RNActivityIndicator color="#fff" size="small" />
        </View>
      )}

      {/* Settings Button */}
      <TouchableOpacity 
        style={[styles.settingsButton, { top: Math.max(insets.top, 16) + 10 }]} 
        onPress={() => router.push('/settings')}
        activeOpacity={0.7}
      >
        <RNText style={styles.settingsIcon}>⚙️</RNText>
      </TouchableOpacity>

      {!state.overlayVisible && (
        <FloatingActionButton 
          onPress={handleFabPress}
          onLongPress={() => router.push('/settings')}
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
  settingsButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  settingsIcon: {
    fontSize: 22,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
  }
});
