import React, { useRef, forwardRef, useImperativeHandle, useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  Animated, PanResponder, Dimensions, TouchableOpacity,
  ActivityIndicator, Image
} from 'react-native';
import { useBreakdown } from '../store/breakdownStore';
import { useSettings } from '../store/settingsStore';
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

const Spoiler = ({ children, style, small, forceReveal }: { children: React.ReactNode, style?: any, small?: boolean, forceReveal?: boolean }) => {
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed || forceReveal;

  if (forceReveal) {
    return <View style={style}>{children}</View>;
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => setRevealed(!revealed)}
      style={[
        style, 
        !isRevealed && { 
          backgroundColor: 'rgba(255, 255, 255, 0.08)', 
          borderRadius: small ? 4 : 8, 
          overflow: 'hidden',
          minWidth: 32, // enough for the eye icon
          minHeight: 24,
        }
      ]}
    >
      <View pointerEvents={isRevealed ? 'auto' : 'none'} style={!isRevealed ? { opacity: 0 } : undefined}>
        {children}
      </View>
      {!isRevealed && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', 
            paddingHorizontal: small ? 6 : 8, 
            paddingVertical: small ? 4 : 6, 
            borderRadius: 12 
          }}>
            <Ionicons name="eye-outline" size={small ? 14 : 16} color="#ddd" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const RegionCard = ({ 
  region, 
  index, 
  vocabulary, 
  grammarPoints, 
  regionLayouts, 
  forceRevealAll, 
  revealGroups,
  screenshotUri
}: any) => {
  const [localReveal, setLocalReveal] = useState({
    readings: false,
    vocabulary: false,
    grammar: false,
  });
  const [showContext, setShowContext] = useState(false);

  const forceRevealReadings = forceRevealAll || revealGroups.readings || localReveal.readings;
  const forceRevealVocab = forceRevealAll || revealGroups.vocabulary || localReveal.vocabulary;
  const forceRevealGrammar = forceRevealAll || revealGroups.grammar || localReveal.grammar;

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  useEffect(() => {
    if (!showContext) {
      pan.setValue({ x: 0, y: 0 });
      pan.flattenOffset();
    }
  }, [showContext, pan]);

  const renderContextImage = () => {
    if (!screenshotUri || !region.boundingBox) return null;
    
    const windowDimensions = Dimensions.get('window');
    const W_orig = windowDimensions.width;
    const H_orig = windowDimensions.height;
    
    let ymin = 0, xmin = 0, ymax = 0, xmax = 0;
    if (Array.isArray(region.boundingBox)) {
      [ymin, xmin, ymax, xmax] = region.boundingBox.map(Number);
    } else if (typeof region.boundingBox === 'object') {
      ymin = Number(region.boundingBox.ymin) || 0;
      xmin = Number(region.boundingBox.xmin) || 0;
      ymax = Number(region.boundingBox.ymax) || 0;
      xmax = Number(region.boundingBox.xmax) || 0;
    }

    const scale = (xmax > 1.5 || ymax > 1.5) ? 1000 : 1;
    const top = (ymin / scale) * H_orig;
    const left = (xmin / scale) * W_orig;
    const height = ((ymax - ymin) / scale) * H_orig;
    const width = ((xmax - xmin) / scale) * W_orig;

    const pad = 40;
    let crop_x = Math.max(0, left - pad);
    let crop_y = Math.max(0, top - pad);
    let crop_w = Math.min(W_orig - crop_x, width + pad * 2);
    let crop_h = Math.min(H_orig - crop_y, height + pad * 2);

    const MAX_WIDTH = W_orig - 64; // Approx width of card inside sheet
    const S = Math.min(1, MAX_WIDTH / crop_w);

    return (
      <View 
        style={{
          width: crop_w * S,
          height: crop_h * S,
          overflow: 'hidden',
          borderRadius: 8,
          marginVertical: 12,
          backgroundColor: '#000',
          alignSelf: 'center',
          borderWidth: 1,
          borderColor: '#444'
        }}
        {...panResponder.panHandlers}
      >
        <Animated.Image 
          source={{ uri: screenshotUri }}
          style={{
            position: 'absolute',
            width: W_orig * S,
            height: H_orig * S,
            left: -crop_x * S,
            top: -crop_y * S,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y }
            ]
          }}
          resizeMode="stretch"
        />
      </View>
    );
  };

  return (
    <View 
      style={styles.card}
      onLayout={(event) => {
        const layout = event.nativeEvent.layout;
        regionLayouts.current[index] = layout.y;
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.regionNumber}>Region {index + 1}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={styles.localToggle} 
            onPress={() => setShowContext(!showContext)}
          >
            <Ionicons name="image-outline" size={14} color="#aaa" />
            <Text style={styles.localToggleText}>Context</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.localToggle} 
            onPress={() => setLocalReveal(prev => ({ ...prev, readings: !prev.readings }))}
          >
            <Ionicons name={localReveal.readings ? "eye-off" : "eye"} size={14} color="#aaa" />
            <Text style={styles.localToggleText}>Readings</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {showContext && renderContextImage()}

      <View style={styles.furiganaContainer}>
         <FuriganaText text={region.text} reading={region.reading} furiganaText={region.furiganaText} forceReveal={forceRevealReadings} />
      </View>
      
      <Spoiler style={styles.translationContainer} forceReveal={forceRevealAll}>
        <Text style={styles.translation} selectable>{region.translation}</Text>
      </Spoiler>
      
      {/* Region Vocabulary */}
      {vocabulary.filter((v: any) => v.regionIndex === index).length > 0 && (
        <View style={styles.subSection}>
          <View style={styles.subSectionHeader}>
            <Text style={styles.subTitle}>Vocabulary</Text>
            <TouchableOpacity 
              style={styles.localToggle} 
              onPress={() => setLocalReveal(prev => ({ ...prev, vocabulary: !prev.vocabulary }))}
            >
              <Ionicons name={localReveal.vocabulary ? "eye-off" : "eye"} size={14} color="#aaa" />
              <Text style={styles.localToggleText}>Reveal</Text>
            </TouchableOpacity>
          </View>
          {vocabulary.filter((v: any) => v.regionIndex === index).map((v: any, vIndex: number) => (
            <View key={vIndex} style={styles.vocabItem}>
              <Text style={styles.vocabWord} selectable>{v.word}</Text>
              <Spoiler style={styles.vocabSpoiler} small={true} forceReveal={forceRevealVocab}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <Text style={styles.vocabReading} selectable>({v.reading})</Text>
                  <Text style={styles.vocabMeaning} selectable>- {v.meaning}</Text>
                </View>
              </Spoiler>
            </View>
          ))}
        </View>
      )}

      {/* Region Grammar */}
      {grammarPoints.filter((g: any) => g.regionIndex === index).length > 0 && (
        <View style={styles.subSection}>
          <View style={styles.subSectionHeader}>
            <Text style={styles.subTitle}>Grammar</Text>
            <TouchableOpacity 
              style={styles.localToggle} 
              onPress={() => setLocalReveal(prev => ({ ...prev, grammar: !prev.grammar }))}
            >
              <Ionicons name={localReveal.grammar ? "eye-off" : "eye"} size={14} color="#aaa" />
              <Text style={styles.localToggleText}>Reveal</Text>
            </TouchableOpacity>
          </View>
          {grammarPoints.filter((g: any) => g.regionIndex === index).map((g: any, gIndex: number) => (
            <View key={gIndex} style={styles.grammarItem}>
              <Text style={styles.grammarPattern} selectable>{g.pattern}</Text>
              <Spoiler style={styles.grammarSpoiler} forceReveal={forceRevealGrammar}>
                <Text style={styles.grammarExplanation} selectable>{g.explanation}</Text>
              </Spoiler>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export const BreakdownSheet = forwardRef<BreakdownSheetRef, BreakdownSheetProps>(({ onDismiss, onReanalyze }, ref) => {
  const { state } = useBreakdown();
  const { settings, updateSettings } = useSettings();
  const [revealAll, setRevealAll] = useState(false);
  const forceRevealAll = revealAll || settings.disableSpoilers;
  const revealGroups = settings.revealGroups || { readings: false, vocabulary: false, grammar: false };
  
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
      setRevealAll(false);
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

  const handleToggleGroup = (group: keyof typeof revealGroups) => {
    updateSettings({
      revealGroups: {
        ...revealGroups,
        [group]: !revealGroups[group]
      }
    });
  };

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
        <View style={styles.headerLeft}>
          <Text style={styles.sheetTitle}>Breakdown</Text>
          {state.isAnalyzing && (
            <View style={styles.analyzingBadge}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.analyzingText}>Analyzing...</Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          {!state.isAnalyzing && (
            <>
              {!settings.disableSpoilers && (
                <TouchableOpacity activeOpacity={0.7} style={styles.iconButton} onPress={() => setRevealAll(!revealAll)}>
                  <Ionicons name={revealAll ? "eye-off-outline" : "eye-outline"} size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity activeOpacity={0.7} style={[styles.iconButton, styles.primaryIconButton]} onPress={onReanalyze}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity activeOpacity={0.7} style={styles.ghostButton} onPress={() => {
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 200,
              useNativeDriver: false,
            }).start(() => onDismiss());
          }}>
            <Ionicons name="close" size={24} color="#bbb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Group Reveal Controls */}
      {!settings.disableSpoilers && !state.isAnalyzing && (
        <View style={styles.groupToggles}>
          <TouchableOpacity 
            style={[styles.groupToggle, revealGroups.readings && styles.groupToggleActive]} 
            onPress={() => handleToggleGroup('readings')}
          >
            <Ionicons name={revealGroups.readings ? "eye-off" : "eye"} size={14} color={revealGroups.readings ? "#000" : "#bbb"} />
            <Text style={[styles.groupToggleText, revealGroups.readings && styles.groupToggleTextActive]}>Readings</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.groupToggle, revealGroups.vocabulary && styles.groupToggleActive]} 
            onPress={() => handleToggleGroup('vocabulary')}
          >
            <Ionicons name={revealGroups.vocabulary ? "eye-off" : "eye"} size={14} color={revealGroups.vocabulary ? "#000" : "#bbb"} />
            <Text style={[styles.groupToggleText, revealGroups.vocabulary && styles.groupToggleTextActive]}>Vocab</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.groupToggle, revealGroups.grammar && styles.groupToggleActive]} 
            onPress={() => handleToggleGroup('grammar')}
          >
            <Ionicons name={revealGroups.grammar ? "eye-off" : "eye"} size={14} color={revealGroups.grammar ? "#000" : "#bbb"} />
            <Text style={[styles.groupToggleText, revealGroups.grammar && styles.groupToggleTextActive]}>Grammar</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <Spoiler forceReveal={forceRevealAll}>
              <Text style={styles.bodyText} selectable>{fullTranslation}</Text>
            </Spoiler>
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
            <RegionCard
              key={index}
              region={region}
              index={index}
              vocabulary={vocabulary}
              grammarPoints={grammarPoints}
              regionLayouts={regionLayouts}
              forceRevealAll={forceRevealAll}
              revealGroups={revealGroups}
              screenshotUri={state.screenshotUri}
            />
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  groupToggles: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a5e',
    marginBottom: 8,
    gap: 8,
  },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  groupToggleActive: {
    backgroundColor: '#fff',
  },
  groupToggleText: {
    color: '#bbb',
    fontSize: 12,
    fontWeight: '600',
  },
  groupToggleTextActive: {
    color: '#000',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  analyzingText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryIconButton: {
    backgroundColor: '#6366f1',
  },
  ghostButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 18,
    color: '#ddd',
    lineHeight: 28,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  regionNumber: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: 'bold',
  },
  furiganaContainer: {
    marginBottom: 12,
  },
  translationContainer: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  translation: {
    fontSize: 17,
    color: '#bbb',
    fontStyle: 'italic',
  },
  subSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#3a3a5e',
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 16,
    color: '#999',
    fontWeight: 'bold',
  },
  vocabItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vocabWord: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 6,
  },
  vocabSpoiler: {
    flexShrink: 1,
  },
  vocabReading: {
    fontSize: 16,
    color: '#888',
    marginRight: 6,
  },
  vocabMeaning: {
    fontSize: 16,
    color: '#ddd',
  },
  grammarItem: {
    marginBottom: 12,
  },
  grammarPattern: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  grammarSpoiler: {
    alignSelf: 'flex-start',
  },
  grammarExplanation: {
    color: '#ddd',
    fontSize: 16,
    lineHeight: 24,
  },
  localToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  localToggleText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
});
