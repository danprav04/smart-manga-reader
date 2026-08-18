import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, Text } from 'react-native';
import { useBreakdown } from '../store/breakdownStore';
import * as Haptics from 'expo-haptics';
import { logger, LogCategory } from '../utils/logger';

interface OverlayLayerProps {
  onRegionTap: (regionIndex: number) => void;
  onDismiss: () => void;
  onReanalyze: () => void;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({ onRegionTap, onDismiss, onReanalyze }) => {
  const { state } = useBreakdown();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const windowDimensions = Dimensions.get('window');

  if (!state.overlayVisible || !state.currentBreakdown) {
    return null;
  }

  logger.debug(LogCategory.UI, `OverlayLayer rendering. imageUri: ${state.screenshotUri}, regions: ${state.currentBreakdown?.textRegions?.length}`);

  const { textRegions = [] } = state.currentBreakdown;
  const imageUri = state.screenshotUri;

  const handleRegionTap = (index: number) => {
    Haptics.selectionAsync();
    onRegionTap(index);
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Frozen Screenshot Background */}
      {imageUri ? (
        <Image 
          source={{ uri: imageUri }} 
          style={StyleSheet.absoluteFillObject}
          resizeMode="stretch" // Use stretch since we map coordinates strictly
          onLayout={(e) => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      )}

      {/* Dimmer overlay to make highlights pop */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} pointerEvents="none" />

      {/* Render Highlights */}
      {textRegions.map((region, index) => {
        let ymin = 0, xmin = 0, ymax = 0, xmax = 0;
        
        if (Array.isArray(region.boundingBox) && region.boundingBox.length >= 4) {
          [ymin, xmin, ymax, xmax] = region.boundingBox.map(Number);
        } else if (region.boundingBox && typeof region.boundingBox === 'object') {
          ymin = Number((region.boundingBox as any).ymin) || 0;
          xmin = Number((region.boundingBox as any).xmin) || 0;
          ymax = Number((region.boundingBox as any).ymax) || 0;
          xmax = Number((region.boundingBox as any).xmax) || 0;
        }
        
        const currentWidth = layout.width || windowDimensions.width;
        const currentHeight = layout.height || windowDimensions.height;
        
        // Auto-detect if coordinates are 0-1 or 0-1000
        const scale = (xmax > 1.5 || ymax > 1.5) ? 1000 : 1;
        
        const top = (ymin / scale) * currentHeight;
        const left = (xmin / scale) * currentWidth;
        const height = ((ymax - ymin) / scale) * currentHeight;
        const width = ((xmax - xmin) / scale) * currentWidth;
        
        logger.debug(LogCategory.UI, `Rendering region ${index} at top:${top}, left:${left}, width:${width}, height:${height}`);

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.highlightZone,
              { top, left, width, height }
            ]}
            onPress={() => handleRegionTap(index)}
          >
            {/* Subtle inner border to indicate tap area */}
            <View style={styles.highlightBorder} />
          </TouchableOpacity>
        );
      })}

      {/* Top Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={onDismiss}>
          <Text style={styles.controlText}>✕ Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onReanalyze}>
          <Text style={styles.controlText}>⚙ Re-analyze</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  highlightZone: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 180, 255, 0.25)', // Faint blue wash
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  controlsContainer: {
    position: 'absolute',
    top: 50, // Safe area roughly
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  controlText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
