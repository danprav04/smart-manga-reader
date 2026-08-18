import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FloatingActionButtonProps {
  onPress: () => void;
  onLongPress?: () => void;
  isLoading: boolean;
  hasCachedBreakdown: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onPress, 
  onLongPress,
  isLoading, 
  hasCachedBreakdown 
}) => {
  const insets = useSafeAreaInsets();
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.();
  };

  return (
    <TouchableOpacity 
      style={[styles.fab, { bottom: Math.max(insets.bottom, 24) + 16 }]} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✨</Text>
          {hasCachedBreakdown && (
            <View style={styles.badge}>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // Minimal drop shadow for depth without being too harsh
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.5)',
  },
});
