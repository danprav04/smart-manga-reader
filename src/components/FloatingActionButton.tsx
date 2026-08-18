import React, { useEffect } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing, 
  withSequence, 
  withSpring 
} from 'react-native-reanimated';

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
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isLoading) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [isLoading]);

  useEffect(() => {
    if (hasCachedBreakdown) {
      scale.value = withSequence(
        withTiming(1.2, { duration: 100 }),
        withSpring(1)
      );
    }
  }, [hasCachedBreakdown]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.();
  };

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ],
    };
  });

  return (
    <TouchableOpacity 
      style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 24) + 16 }]} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      <BlurView 
        intensity={80} 
        tint="dark" 
        style={styles.blurContainer}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.iconContainer}>
            <Animated.View style={animatedIconStyle}>
              <Ionicons 
                name="sparkles" 
                size={26} 
                color={hasCachedBreakdown ? "#4CAF50" : "#fff"} 
              />
            </Animated.View>
            
            {hasCachedBreakdown && (
              <View style={styles.badge} />
            )}
          </View>
        )}
      </BlurView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    // Premium drop shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.4)', // Base tint
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 32,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.6)',
  },
});
