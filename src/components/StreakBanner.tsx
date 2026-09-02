import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface StreakBannerProps {
  visible: boolean;
  streakCount: number;
  milestoneReached: number | null;
  onDismiss: () => void;
}

const getMilestoneMessage = (milestone: number): string => {
  switch (milestone) {
    case 7: return "One week strong!";
    case 14: return "Two weeks!";
    case 30: return "Amazing dedication!";
    case 60: return "Incredible!";
    case 100: return "Legendary!";
    case 365: return "One year! 🎉";
    default: return "Amazing!";
  }
};

export const StreakBanner: React.FC<StreakBannerProps> = ({
  visible,
  streakCount,
  milestoneReached,
  onDismiss,
}) => {
  const [translateY] = useState(() => new Animated.Value(-100));

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 12,
      }).start();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      timeoutId = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismiss();
        });
      }, 3500);
    } else {
      translateY.setValue(-100);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [visible, onDismiss, translateY]);

  // We can't render null immediately if we want to animate out,
  // but since the parent controls `visible`, and we want to allow the dismiss animation,
  // wait - the parent might unmount it. Actually, the requirements say:
  // "When visible becomes false, reset animation". 
  // If we return null, it won't render at all.
  // We'll keep it rendered but shifted out (-100) when invisible if the parent keeps it mounted.
  // Wait, if it auto-dismisses, it slides up THEN calls onDismiss.
  // If parent sets visible=false upon onDismiss, it will unmount or render hidden.
  // We'll rely on translateY to hide it.
  
  // Render off-screen if not visible
  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      {milestoneReached ? (
        <Text style={[styles.text, styles.milestoneText]}>
          🏆 {milestoneReached}-day streak! {getMilestoneMessage(milestoneReached)}
        </Text>
      ) : (
        <Text style={styles.text}>
          🎯 Daily goal reached! 🔥 {streakCount}-day streak
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: 'rgba(40, 40, 60, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  milestoneText: {
    fontSize: 17,
  },
});
