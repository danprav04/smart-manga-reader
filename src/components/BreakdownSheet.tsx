import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useBreakdown } from '../store/breakdownStore';
import { FuriganaText } from './FuriganaText';

export interface BreakdownSheetRef {
  scrollToRegion: (regionIndex: number) => void;
  expandToHalf: () => void;
}

export const BreakdownSheet = forwardRef<BreakdownSheetRef, {}>((props, ref) => {
  const { state } = useBreakdown();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const regionLayouts = useRef<{ [key: number]: number }>({});

  const snapPoints = useMemo(() => ['12%', '50%', '90%'], []);

  useImperativeHandle(ref, () => ({
    scrollToRegion: (regionIndex: number) => {
      const yPos = regionLayouts.current[regionIndex];
      if (yPos !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: yPos, animated: true });
      }
    },
    expandToHalf: () => {
      bottomSheetRef.current?.snapToIndex(1);
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
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
      style={{ zIndex: 100, elevation: 10 }}
    >
      <ScrollView ref={scrollViewRef} style={styles.contentContainer}>
        
        {/* Full Translation Section */}
        {fullTranslation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Full Translation</Text>
            <Text style={styles.bodyText}>{fullTranslation}</Text>
          </View>
        )}

        {/* Text Regions */}
        <View style={styles.section}>
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
                 <FuriganaText text={region.text} reading={region.reading} />
              </View>
              <Text style={styles.translation}>{region.translation}</Text>
              
              {/* Region Vocabulary */}
              {vocabulary.filter(v => v.regionIndex === index).length > 0 && (
                <View style={styles.subSection}>
                  <Text style={styles.subTitle}>Vocabulary</Text>
                  {vocabulary.filter(v => v.regionIndex === index).map((v, vIndex) => (
                    <View key={vIndex} style={styles.vocabItem}>
                      <Text style={styles.vocabWord}>{v.word}</Text>
                      <Text style={styles.vocabReading}>({v.reading})</Text>
                      <Text style={styles.vocabMeaning}>- {v.meaning}</Text>
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
                      <Text style={styles.grammarPattern}>{g.pattern}</Text>
                      <Text style={styles.grammarExplanation}>{g.explanation}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#1a1a2e',
  },
  indicator: {
    backgroundColor: '#fff',
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
