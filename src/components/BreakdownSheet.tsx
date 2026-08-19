import React, { useRef, forwardRef, useImperativeHandle, useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  Animated, PanResponder, Dimensions, TouchableOpacity 
} from 'react-native';
import { useBreakdown } from '../store/breakdownStore';
import { FuriganaText } from './FuriganaText';
import { logger, LogCategory } from '../utils/logger';
import { Ionicons } from '@expo/vector-icons';

export interface BreakdownSheetRef {
  scrollToRegion: (regionIndex: number) => void;
  expandToHalf: () => void;
  dismiss: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Snap positions as fractions of screen height (from top)
const SNAP_TOP_COLLAPSED = SCREEN_HEIGHT * 0.88;  // 12% visible
const SNAP_TOP_HALF = SCREEN_HEIGHT * 0.50;        // 50% visible
const SNAP_TOP_EXPANDED = SCREEN_HEIGHT * 0.10;    // 90% visible

interface BreakdownSheetProps {
  onDismiss: () => void;
  onReanalyze: () => void;
}

export const BreakdownSheet = forwardRef<BreakdownSheetRef, BreakdownSheetProps>(({ onDismiss, onReanalyze }, ref) => {
  const { state } = useBreakdown();
  const scrollViewRef = useRef<ScrollView>(null);
  const regionLayouts = useRef<{ [key: number]: number }>({});
  const textRegionsOffsetY = useRef<number>(0);
  const translateY = useRef(new Animated.Value(SNAP_TOP_COLLAPSED)).current;
  const currentSnap = useRef(SNAP_TOP_COLLAPSED);

  // Reset position when overlay becomes visible
  useEffect(() => {
    if (state.overlayVisible) {
      translateY.setValue(SNAP_TOP_COLLAPSED);
      currentSnap.current = SNAP_TOP_COLLAPSED;
    }
  }, [state.overlayVisible]);

  const snapTo = useCallback((toValue: number) => {
    currentSnap.current = toValue;
    Animated.spring(translateY, {
      toValue,
      damping: 25,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture vertical drags on the handle area
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = currentSnap.current + gestureState.dy;
        // Clamp between expanded and off-screen
        const clamped = Math.max(SNAP_TOP_EXPANDED, Math.min(SCREEN_HEIGHT, newY));
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = currentSnap.current + gestureState.dy;
        const velocity = gestureState.vy;

        // Dismiss conditions
        if (currentY > SNAP_TOP_COLLAPSED + 50 || (velocity > 0.5 && currentSnap.current === SNAP_TOP_COLLAPSED)) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onDismiss());
          return;
        }

        // Determine which snap point to go to based on position and velocity
        let target: number;
        if (velocity > 0.5) {
          // Swiping down
          target = currentY < SNAP_TOP_HALF ? SNAP_TOP_HALF : SNAP_TOP_COLLAPSED;
        } else if (velocity < -0.5) {
          // Swiping up
          target = currentY > SNAP_TOP_HALF ? SNAP_TOP_HALF : SNAP_TOP_EXPANDED;
        } else {
          // Choose nearest snap point
          const distances = [
            { snap: SNAP_TOP_COLLAPSED, dist: Math.abs(currentY - SNAP_TOP_COLLAPSED) },
            { snap: SNAP_TOP_HALF, dist: Math.abs(currentY - SNAP_TOP_HALF) },
            { snap: SNAP_TOP_EXPANDED, dist: Math.abs(currentY - SNAP_TOP_EXPANDED) },
          ];
          distances.sort((a, b) => a.dist - b.dist);
          target = distances[0].snap;
        }
        snapTo(target);
      },
    })
  ).current;

  useImperativeHandle(ref, () => ({
    scrollToRegion: (regionIndex: number) => {
      logger.debug(LogCategory.UI, `BreakdownSheet.scrollToRegion(${regionIndex}) called. yPos: ${regionLayouts.current[regionIndex]}`);
      const cardY = regionLayouts.current[regionIndex];
      if (cardY !== undefined && scrollViewRef.current) {
        // cardY is relative to the Text Regions section, need to add the section's Y offset
        const absoluteY = (textRegionsOffsetY.current || 0) + cardY;
        scrollViewRef.current.scrollTo({ y: absoluteY, animated: true });
      }
    },
    expandToHalf: () => {
      logger.debug(LogCategory.UI, `BreakdownSheet.expandToHalf() called`);
      snapTo(SNAP_TOP_HALF);
    },
    dismiss: () => {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: false,
      }).start(() => onDismiss());
    }
  }));

  if (!state.overlayVisible || !state.currentBreakdown) {
    return null;
  }

  const { 
    fullTranslation, 
    textRegions = [], 
    vocabulary = [], 
    grammarPoints = [] 
  } = state.currentBreakdown;

  return (
    <Animated.View
      style={[
        styles.sheetContainer,
        { top: translateY },
      ]}
    >
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Header Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity activeOpacity={0.7} style={styles.controlButton} onPress={() => {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onDismiss());
        }}>
          <Ionicons name="close" size={18} color="#fff" />
          <Text style={styles.controlText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.controlButton} onPress={onReanalyze}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.controlText}>Re-analyze</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {/* Full Translation Section */}
        {fullTranslation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Full Translation</Text>
            <Text style={styles.bodyText} selectable>{fullTranslation}</Text>
          </View>
        )}

        {/* Text Regions */}
        <View 
          style={styles.section}
          onLayout={(event) => {
            textRegionsOffsetY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>💬 Text Regions</Text>
          {textRegions.map((region, index) => (
            <View 
              key={index} 
              style={styles.card}
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                regionLayouts.current[index] = layout.y;
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.regionNumber}>Region {index + 1}</Text>
              </View>
              <View style={styles.furiganaContainer}>
                 <FuriganaText text={region.text} reading={region.reading} furiganaText={region.furiganaText} />
              </View>
              <Text style={styles.translation} selectable>{region.translation}</Text>
              
              {/* Region Vocabulary */}
              {vocabulary.filter(v => v.regionIndex === index).length > 0 && (
                <View style={styles.subSection}>
                  <Text style={styles.subTitle}>Vocabulary</Text>
                  {vocabulary.filter(v => v.regionIndex === index).map((v, vIndex) => (
                    <View key={vIndex} style={styles.vocabItem}>
                      <Text style={styles.vocabWord} selectable>{v.word}</Text>
                      <Text style={styles.vocabReading} selectable>({v.reading})</Text>
                      <Text style={styles.vocabMeaning} selectable>- {v.meaning}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Region Grammar */}
              {grammarPoints.filter(g => g.regionIndex === index).length > 0 && (
                <View style={styles.subSection}>
                  <Text style={styles.subTitle}>Grammar</Text>
                  {grammarPoints.filter(g => g.regionIndex === index).map((g, gIndex) => (
                    <View key={gIndex} style={styles.grammarItem}>
                      <Text style={styles.grammarPattern} selectable>{g.pattern}</Text>
                      <Text style={styles.grammarExplanation} selectable>{g.explanation}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <Animated.View style={{ 
          height: translateY.interpolate({
            inputRange: [0, SCREEN_HEIGHT],
            outputRange: [40, SCREEN_HEIGHT + 40]
          }) 
        }} />
      </ScrollView>
    </Animated.View>
  );
});

BreakdownSheet.displayName = 'BreakdownSheet';

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 101,
    elevation: 11,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
    opacity: 0.6,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a5e',
    marginBottom: 8,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  controlText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 16,
    color: '#ddd',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  cardHeader: {
    marginBottom: 8,
  },
  regionNumber: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: 'bold',
  },
  furiganaContainer: {
    marginBottom: 8,
  },
  translation: {
    fontSize: 15,
    color: '#bbb',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  subSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#3a3a5e',
  },
  subTitle: {
    fontSize: 14,
    color: '#999',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  vocabItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  vocabWord: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 4,
  },
  vocabReading: {
    color: '#888',
    marginRight: 4,
  },
  vocabMeaning: {
    color: '#ddd',
  },
  grammarItem: {
    marginBottom: 8,
  },
  grammarPattern: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  grammarExplanation: {
    color: '#ddd',
    fontSize: 14,
  },
});
