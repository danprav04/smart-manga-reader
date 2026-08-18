import React, { useRef, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text as RNText, BackHandler, ActivityIndicator as RNActivityIndicator, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettings } from '../src/store/settingsStore';
import { useBreakdown } from '../src/store/breakdownStore';
import { readerConfig } from '../src/config/readerConfig';
import { captureWebView } from '../src/services/screenshotService';
import { analyzeScreenshot } from '../src/services/aiService';
import { hasBreakdownForUrl, getBreakdownByUrl, saveBreakdown } from '../src/services/databaseService';
import { logger, LogCategory } from '../src/utils/logger';

import { FloatingActionButton } from '../src/components/FloatingActionButton';
import { OverlayLayer } from '../src/components/OverlayLayer';
import { BreakdownSheet, BreakdownSheetRef } from '../src/components/BreakdownSheet';

export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  const { state, dispatch } = useBreakdown();
  
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const sheetRef = useRef<BreakdownSheetRef>(null);
  const lastProcessedUrl = useRef<string | null>(null);
  const lastAnalyzedScrollY = useRef<number>(0);

  const [currentUrl, setCurrentUrl] = useState(settings.readerBaseUrl || readerConfig.defaultUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [currentScrollY, setCurrentScrollY] = useState(0);

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
      logger.info(LogCategory.UI, `Navigation state changed to ${url}. Cache exists: ${hasCache}`);
      dispatch({ type: 'SET_URL', payload: { url, hasCache } });
      // Reset scroll tracking for new URL
      lastAnalyzedScrollY.current = 0;
      setCurrentScrollY(0);
    } catch (e) {
      logger.error(LogCategory.UI, "Failed to check cache for url", e);
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
              html { filter: sepia(0.5) brightness(0.6) hue-rotate(-10deg) !important; background-color: #111 !important; }
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
    
    logger.info(LogCategory.UI, `performAnalysis called for ${urlToAnalyze}. Reanalyze: ${reanalyze}, HasCache: ${state.hasCachedBreakdown}`);

    if (!reanalyze && state.hasCachedBreakdown) {
      // Load from cache
      try {
        const cached = await getBreakdownByUrl(urlToAnalyze);
        if (cached) {
          let fileExists = true;
          if (cached.screenshotPath) {
            const info = await FileSystem.getInfoAsync(cached.screenshotPath);
            fileExists = info.exists;
          }
          
          if (fileExists) {
            logger.info(LogCategory.UI, `Loaded cached breakdown for ${urlToAnalyze}`);
            dispatch({ type: 'LOAD_CACHED', payload: cached });
            lastAnalyzedScrollY.current = currentScrollY; // Assume we loaded it for current view
            return;
          } else {
            logger.warn(LogCategory.UI, `Cache exists for ${urlToAnalyze} but screenshot file is missing. Forcing fresh analysis.`);
          }
        }
      } catch (e) {
        logger.error(LogCategory.UI, "Failed to load cached breakdown", e);
      }
    }

    // Capture and analyze
    try {
      logger.info(LogCategory.UI, `Starting fresh AI analysis...`);
      dispatch({ type: 'START_ANALYSIS' });
      
      const { uri, base64 } = await captureWebView(viewShotRef.current);
      
      const result = await analyzeScreenshot(base64, settings);
      
      // Save to SQLite
      const domain = new URL(urlToAnalyze).hostname;
      await saveBreakdown(urlToAnalyze, domain, result, uri);
      logger.info(LogCategory.UI, `Analysis saved to database.`);
      
      lastAnalyzedScrollY.current = currentScrollY;
      dispatch({ type: 'ANALYSIS_COMPLETE', payload: { result, screenshotUri: uri } });
    } catch (e: any) {
      logger.error(LogCategory.UI, "Analysis failed", e);
      Alert.alert("Analysis Failed", e.message || "Something went wrong.");
      dispatch({ type: 'ANALYSIS_ERROR', payload: e.message });
    }
  };

  const handleFabPress = () => {
    performAnalysis(currentUrl);
  };

  const handleReanalyze = () => {
    logger.info(LogCategory.UI, `User requested re-analysis`);
    performAnalysis(currentUrl, true);
  };

  const handleRegionTap = (regionIndex: number) => {
    logger.debug(LogCategory.UI, `Region ${regionIndex} tapped. sheetRef.current: ${sheetRef.current ? 'EXISTS' : 'NULL'}`);
    sheetRef.current?.expandToHalf();
    setTimeout(() => {
      logger.debug(LogCategory.UI, `scrollToRegion(${regionIndex}) called. sheetRef.current: ${sheetRef.current ? 'EXISTS' : 'NULL'}`);
      sheetRef.current?.scrollToRegion(regionIndex);
    }, 100); // small delay to allow expansion
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SCROLL') {
        const scrollY = data.scrollY;
        setCurrentScrollY(scrollY);
        
        // If we have a cached breakdown, but the user scrolled more than 300px from the last analyzed position,
        // we invalidate the cache so tapping FAB will trigger a fresh analysis.
        if (state.hasCachedBreakdown && Math.abs(scrollY - lastAnalyzedScrollY.current) > 300) {
          logger.info(LogCategory.UI, `User scrolled significantly (${scrollY} vs ${lastAnalyzedScrollY.current}). Invalidating viewport cache.`);
          dispatch({ type: 'INVALIDATE_CACHE' });
        }
      } else if (data.type === 'PAGE_TURN') {
        if (state.hasCachedBreakdown) {
          logger.info(LogCategory.UI, 'SPA page turn detected (DOM mutation). Invalidating cache.');
          dispatch({ type: 'INVALIDATE_CACHE' });
        }
      }
    } catch (e) {
      // Ignore parse errors from other messages
    }
  };

  const handleLoadEnd = async () => {
    setIsPageLoading(false);
  };

  const handleSetBaseUrl = () => {
    updateSettings({ readerBaseUrl: currentUrl });
    Alert.alert("Base URL Updated", "The app will now start from this page.");
  };

  // Check if current URL is different from base URL (ignoring trailing slashes or minor differences)
  const isDifferentFromBase = () => {
    const base = (settings.readerBaseUrl || readerConfig.defaultUrl).replace(/\/$/, '');
    const current = currentUrl.replace(/\/$/, '');
    return base !== current;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: settings.darkMode ? '#000' : '#F2F2F7' }]}>
      <ViewShot ref={viewShotRef} style={[styles.container, { backgroundColor: settings.darkMode ? '#000' : '#F2F2F7' }]} options={{ format: 'jpg', quality: 0.9 }}>
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
          onLoadEnd={handleLoadEnd}
          {...readerConfig.webViewProps}
          onMessage={handleWebViewMessage}
          androidLayerType={state.overlayVisible ? 'software' : 'hardware'}
          style={[styles.webview, { opacity: 0.99 }]}
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
                html { filter: sepia(0.5) brightness(0.6) hue-rotate(-10deg) !important; background-color: #111 !important; }
              \`;
              document.head.appendChild(nightStyle);
            ` : ''}
            
            // Scroll tracking
            let lastScrollTime = 0;
            window.addEventListener('scroll', () => {
              const now = Date.now();
              if (now - lastScrollTime > 500) {
                lastScrollTime = now;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCROLL', scrollY: window.scrollY }));
              }
            });
            
            // SPA Page Turn tracking (DOM Mutation)
            let lastMutationTime = 0;
            const observer = new MutationObserver((mutations) => {
              const now = Date.now();
              if (now - lastMutationTime > 1500) {
                let significant = false;
                for (let m of mutations) {
                  if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'style')) significant = true;
                  if (m.addedNodes && m.addedNodes.length > 0) significant = true;
                }
                
                if (significant) {
                  lastMutationTime = now;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_TURN' }));
                }
              }
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });
            
            true;
            `
          }
        />
      </ViewShot>

      {/* Overlay + BreakdownSheet rendered in a Modal — guarantees a separate
          Android Window that paints above the WebView's SurfaceView. */}
      <Modal
        visible={state.overlayVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => dispatch({ type: 'DISMISS_OVERLAY' })}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <OverlayLayer 
            onRegionTap={handleRegionTap}
            onDismiss={() => {
              if (sheetRef.current) {
                sheetRef.current.dismiss();
              } else {
                dispatch({ type: 'DISMISS_OVERLAY' });
              }
            }}
          />
          <BreakdownSheet 
            ref={sheetRef} 
            onDismiss={() => dispatch({ type: 'DISMISS_OVERLAY' })}
            onReanalyze={handleReanalyze}
          />

          {/* Settings Button (Inside Modal) */}
          <TouchableOpacity 
            style={[styles.settingsButton, { top: Math.max(insets.top, 16) + 10 }]} 
            onPress={() => {
              dispatch({ type: 'DISMISS_OVERLAY' });
              router.push('/settings');
            }}
            activeOpacity={0.7}
          >
            <RNText style={styles.settingsIcon}>⚙️</RNText>
          </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>

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

      {/* Set Base URL Button */}
      {isDifferentFromBase() && (
        <TouchableOpacity 
          style={[styles.settingsButton, { top: Math.max(insets.top, 16) + 64 }]} 
          onPress={handleSetBaseUrl}
          activeOpacity={0.7}
        >
          <RNText style={styles.settingsIcon}>📌</RNText>
        </TouchableOpacity>
      )}

      {!state.overlayVisible && (
        <FloatingActionButton 
          onPress={handleFabPress}
          onLongPress={() => performAnalysis(currentUrl, true)}
          isLoading={state.isAnalyzing}
          hasCachedBreakdown={state.hasCachedBreakdown}
        />
      )}


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
